import * as vscode from 'vscode';

import { indexDocument, SymbolDef } from '../language/symbolIndex';
import {
  isKnownMnemonic,
  lookupInstruction,
  REGISTERS,
} from '../language/instructionSet';
import {
  ASSIGN_DEF_RE,
  LABEL_DEF_RE,
  MACRO_DEF_RE,
  MNEMONIC_RE,
  findEndLineIndex,
  stripComment,
} from '../language/parsing';
import { matchBlocks, UnmatchedEnd } from '../language/blockMatcher';

const UNIQUE_KINDS = new Set(['label', 'equ', 'bit', 'data', 'macro']);

function countOperands(operandText: string): number {
  const trimmed = operandText.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  // Split on top-level commas only (ignore commas inside quotes).
  let depth = 0;
  let count = 1;
  let inString = false;
  for (const ch of trimmed) {
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '(') {
      depth++;
    } else if (!inString && ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (!inString && depth === 0 && ch === ',') {
      count++;
    }
  }
  return count;
}

/** Splits operand text on top-level commas (ignoring commas inside quotes/parens), returning each operand with its start offset within `text`. */
function splitTopLevelOperands(
  text: string,
): { value: string; start: number }[] {
  const operands: { value: string; start: number }[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '(') {
      depth++;
    } else if (!inString && ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (!inString && depth === 0 && ch === ',') {
      operands.push({ value: text.slice(start, i), start });
      start = i + 1;
    }
  }
  operands.push({ value: text.slice(start), start });
  return operands;
}

const IDENTIFIER_RE = /^[A-Za-z_?][A-Za-z0-9_?]*$/;
const REGISTER_SET = new Set(REGISTERS.map((r) => r.toUpperCase()));

// Instructions whose last operand is a code label (branch/call target).
const BRANCH_TARGET_MNEMONICS = new Set([
  'ACALL',
  'AJMP',
  'LCALL',
  'LJMP',
  'SJMP',
  'JC',
  'JNC',
  'JZ',
  'JNZ',
  'JB',
  'JNB',
  'JBC',
  'CJNE',
  'DJNZ',
]);

function checkBranchTarget(
  mnemonicToken: string,
  operandText: string,
  operandCol: number,
  lineNo: number,
  index: Map<string, SymbolDef[]>,
  diagnostics: vscode.Diagnostic[],
): void {
  if (!BRANCH_TARGET_MNEMONICS.has(mnemonicToken.toUpperCase())) {
    return;
  }

  const operands = splitTopLevelOperands(operandText);
  const last = operands[operands.length - 1];
  const target = last.value.trim();
  if (!IDENTIFIER_RE.test(target) || REGISTER_SET.has(target.toUpperCase())) {
    return; // not a bare identifier (immediate/indirect/bit-address/...) or a register.
  }

  if (!index.has(target.toUpperCase())) {
    const targetCol = operandCol + last.start + last.value.indexOf(target);
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(lineNo, targetCol, lineNo, targetCol + target.length),
        vscode.l10n.t("Cannot find a definition for label '{0}'.", target),
        vscode.DiagnosticSeverity.Warning,
      ),
    );
  }
}

const INVALID_INDIRECT_RE = /(?<![A-Za-z0-9_])@R[2-7](?![A-Za-z0-9_])/gi;

/** @R0 and @R1 are the only addressable indirect registers; @R2-@R7 highlight fine (the grammar stays lenient) but are never valid operands. */
function checkIndirectAddressing(
  operandText: string,
  operandCol: number,
  lineNo: number,
  diagnostics: vscode.Diagnostic[],
): void {
  for (const match of operandText.matchAll(INVALID_INDIRECT_RE)) {
    const start = operandCol + (match.index ?? 0);
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(lineNo, start, lineNo, start + match[0].length),
        vscode.l10n.t(
          "Indirect addressing '{0}' is invalid - only @R0 and @R1 are addressable.",
          match[0],
        ),
        vscode.DiagnosticSeverity.Error,
      ),
    );
  }
}

function checkMnemonicLine(
  mnemonicToken: string,
  operandText: string,
  lineNo: number,
  mnemonicCol: number,
  index: Map<string, SymbolDef[]>,
  diagnostics: vscode.Diagnostic[],
): void {
  if (mnemonicToken.length === 0 || mnemonicToken.startsWith('$')) {
    return; // compiler-control directive ($INCLUDE, $TITLE, ...) - not validated here.
  }

  const macroDefs = index.get(mnemonicToken.toUpperCase());
  if (macroDefs?.some((def) => def.kind === 'macro')) {
    return; // a call to a user-defined macro, not a built-in mnemonic.
  }

  if (!isKnownMnemonic(mnemonicToken)) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(
          lineNo,
          mnemonicCol,
          lineNo,
          mnemonicCol + mnemonicToken.length,
        ),
        vscode.l10n.t("Unknown instruction or directive '{0}'.", mnemonicToken),
        vscode.DiagnosticSeverity.Warning,
      ),
    );
    return;
  }

  const spec = lookupInstruction(mnemonicToken);
  if (spec) {
    const expected = spec.operands[0];
    const actual = countOperands(operandText);
    if (
      !spec.operands.includes(actual) &&
      !(expected === 0 && operandText.trim() === '')
    ) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(
            lineNo,
            mnemonicCol,
            lineNo,
            mnemonicCol + mnemonicToken.length,
          ),
          vscode.l10n.t(
            "'{0}' expects {1} operand(s), found {2}.",
            mnemonicToken.toUpperCase(),
            expected,
            actual,
          ),
          vscode.DiagnosticSeverity.Warning,
        ),
      );
    }
  }
}

function unmatchedEndMessage(keyword: UnmatchedEnd['keyword']): string {
  switch (keyword) {
    case 'ENDIF':
      return vscode.l10n.t("'ENDIF' without matching 'IF'.");
    case 'ENDM':
      return vscode.l10n.t("'ENDM' without matching 'MACRO' or 'REPT'.");
    case 'ENDW':
      return vscode.l10n.t("'ENDW' without matching 'WHILE'.");
  }
}

function checkBlockBalance(
  lines: string[],
  diagnostics: vscode.Diagnostic[],
): void {
  const { unmatchedEnds, unclosed } = matchBlocks(lines);

  for (const end of unmatchedEnds) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(end.line, 0, end.line, lines[end.line].length),
        unmatchedEndMessage(end.keyword),
        vscode.DiagnosticSeverity.Error,
      ),
    );
  }

  for (const frame of unclosed) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(frame.line, 0, frame.line, lines[frame.line].length),
        vscode.l10n.t("'{0}' block is never closed.", frame.kind),
        vscode.DiagnosticSeverity.Error,
      ),
    );
  }
}

function checkDuplicateSymbols(
  index: Map<string, SymbolDef[]>,
  diagnostics: vscode.Diagnostic[],
): void {
  for (const defs of index.values()) {
    const uniqueDefs = defs.filter((d) => UNIQUE_KINDS.has(d.kind));
    if (uniqueDefs.length > 1) {
      for (const def of uniqueDefs) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(
              def.line,
              def.character,
              def.line,
              def.character + def.length,
            ),
            vscode.l10n.t("Symbol '{0}' is defined more than once.", def.name),
            vscode.DiagnosticSeverity.Error,
          ),
        );
      }
    }
  }
}

export function buildDiagnostics(
  doc: vscode.TextDocument,
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const index = indexDocument(doc);

  const allLines: string[] = [];
  for (let line = 0; line < doc.lineCount; line++) {
    allLines.push(doc.lineAt(line).text);
  }
  // A51 stops assembling at a top-level END - nothing after it is real code.
  const endIdx = findEndLineIndex(allLines);
  const lastLine = endIdx === -1 ? allLines.length - 1 : endIdx;

  for (let line = 0; line <= lastLine; line++) {
    const raw = allLines[line];
    const text = stripComment(raw);
    if (text.trim().length === 0) {
      continue;
    }

    let rest = text;
    let col = 0;

    const labelMatch = LABEL_DEF_RE.exec(text);
    if (labelMatch) {
      rest = labelMatch[2];
      col = text.length - rest.length;
      if (rest.trim().length === 0) {
        continue; // label-only line
      }
    } else {
      const assignMatch = ASSIGN_DEF_RE.exec(text) ?? MACRO_DEF_RE.exec(text);
      if (assignMatch) {
        continue; // "NAME EQU value" style lines are definitions, not instructions.
      }
    }

    const mnemonicMatch = MNEMONIC_RE.exec(rest);
    if (!mnemonicMatch) {
      continue;
    }
    const mnemonicToken = mnemonicMatch[1];
    const mnemonicCol =
      col + (mnemonicMatch.index + rest.indexOf(mnemonicToken));
    const operandText = mnemonicMatch[2] ?? '';
    const operandCol = col + (rest.length - operandText.length);

    checkMnemonicLine(
      mnemonicToken,
      operandText,
      line,
      mnemonicCol,
      index,
      diagnostics,
    );
    checkBranchTarget(
      mnemonicToken,
      operandText,
      operandCol,
      line,
      index,
      diagnostics,
    );
    checkIndirectAddressing(operandText, operandCol, line, diagnostics);
  }

  checkBlockBalance(allLines.slice(0, lastLine + 1), diagnostics);
  checkDuplicateSymbols(index, diagnostics);

  return diagnostics;
}
