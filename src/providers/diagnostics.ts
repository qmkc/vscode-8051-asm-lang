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
  splitCodeAndComment,
  stripComment,
} from '../language/parsing';
import { matchBlocks, UnmatchedEnd } from '../language/blockMatcher';

const UNIQUE_KINDS = new Set(['label', 'equ', 'bit', 'data', 'macro']);

/**
 * Rule codes assigned to each diagnostic - used by `a51.diagnostics.severity` and by
 * `a51-disable-line`/`a51-disable-next-line` comments. Keep in sync with the `properties` list
 * for that setting in package.json and the table in README.md.
 *
 * The prefix groups rules by what they need to detect the problem:
 * - `AS` (syntax)   - detectable from a single line's tokens/structure alone
 * - `AM` (semantic)  - needs the symbol table or an instruction's known operand/addressing rules
 *
 * - AS001 unknown-instruction - unknown instruction or directive
 * - AS002 unmatched-end       - `ENDIF`/`ENDM`/`ENDW` without a matching opening block
 * - AS003 unclosed-block      - `MACRO`/`IF`/`REPT`/`WHILE` block never closed
 * - AM001 operand-count       - wrong number of operands for a known instruction
 * - AM002 invalid-indirect    - `@R2`-`@R7` indirect addressing (only `@R0`/`@R1` are addressable)
 * - AM003 unresolved-label    - branch/call target with no matching label definition
 * - AM004 duplicate-symbol    - a symbol defined more than once
 */
export const DIAGNOSTIC_RULES = {
  UnknownInstruction: 'AS001',
  UnmatchedEnd: 'AS002',
  UnclosedBlock: 'AS003',
  OperandCount: 'AM001',
  InvalidIndirect: 'AM002',
  UnresolvedLabel: 'AM003',
  DuplicateSymbol: 'AM004',
} as const;

export type DiagnosticRuleId =
  (typeof DIAGNOSTIC_RULES)[keyof typeof DIAGNOSTIC_RULES];

const RULE_ID_SET: Set<string> = new Set(Object.values(DIAGNOSTIC_RULES));

/** Human-readable slug for each rule code, e.g. for use in code action titles. */
export const RULE_SLUGS: Readonly<Record<string, string>> = {
  [DIAGNOSTIC_RULES.UnknownInstruction]: 'unknown-instruction',
  [DIAGNOSTIC_RULES.UnmatchedEnd]: 'unmatched-end',
  [DIAGNOSTIC_RULES.UnclosedBlock]: 'unclosed-block',
  [DIAGNOSTIC_RULES.OperandCount]: 'operand-count',
  [DIAGNOSTIC_RULES.InvalidIndirect]: 'invalid-indirect',
  [DIAGNOSTIC_RULES.UnresolvedLabel]: 'unresolved-label',
  [DIAGNOSTIC_RULES.DuplicateSymbol]: 'duplicate-symbol',
};

/** `off` drops the diagnostic entirely; `error`/`warning` override its built-in default severity. */
export type SeverityOverride = 'error' | 'warning' | 'off';

const SEVERITY_VALUES: Readonly<
  Record<Exclude<SeverityOverride, 'off'>, vscode.DiagnosticSeverity>
> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
};

export interface DiagnosticsOptions {
  enabled: boolean;
  severity: Readonly<Record<string, SeverityOverride>>;
}

function isSeverityOverride(value: unknown): value is SeverityOverride {
  return value === 'error' || value === 'warning' || value === 'off';
}

/** Reads the raw `diagnostics.severity` setting, keeping only entries whose key is a known rule code (normalized to upper case) and whose value is a valid override. */
function normalizeSeverityMap(
  raw: Record<string, unknown> | undefined,
): Record<string, SeverityOverride> {
  const result: Record<string, SeverityOverride> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const code = key.toUpperCase();
    if (RULE_ID_SET.has(code) && isSeverityOverride(value)) {
      result[code] = value;
    }
  }
  return result;
}

function resolveOptions(doc: vscode.TextDocument): DiagnosticsOptions {
  const cfg = vscode.workspace.getConfiguration('a51', doc.uri);
  return {
    enabled: cfg.get<boolean>('diagnostics.enable', true),
    severity: normalizeSeverityMap(
      cfg.get<Record<string, unknown>>('diagnostics.severity', {}),
    ),
  };
}

/** Line-level suppression state collected from `a51-disable-line`/`a51-disable-next-line` comments: 'all' suppresses every rule on that line, a Set suppresses only the named rules. */
type SuppressionMap = Map<number, 'all' | Set<string>>;

// Not anchored to the start of the comment, so a disable directive can follow other
// prose in the same comment (e.g. one a code action appended after an existing note).
// Global, so a comment that mixes a `line` and a `next-line` directive (e.g. the skip-line
// quick fix appending onto an existing next-line note) finds both instead of letting the
// first match's capture swallow the second directive's rule codes into the wrong line.
const SUPPRESS_RE = /a51-disable-(line|next-line)\b/gi;

function ruleTokensFrom(rest: string): 'all' | Set<string> {
  const tokens = rest
    .split(/[\s,]+/)
    .map((t) => t.toUpperCase())
    .filter((t) => RULE_ID_SET.has(t));
  return tokens.length === 0 ? 'all' : new Set(tokens);
}

function mergeSuppression(
  map: SuppressionMap,
  line: number,
  value: 'all' | Set<string>,
): void {
  const existing = map.get(line);
  if (existing === 'all' || value === 'all') {
    map.set(line, 'all');
    return;
  }
  if (!existing) {
    map.set(line, new Set(value));
    return;
  }
  for (const rule of value) {
    existing.add(rule);
  }
}

function collectSuppressions(lines: string[]): SuppressionMap {
  const map: SuppressionMap = new Map();
  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitCodeAndComment(lines[i]);
    if (comment.length === 0) {
      continue;
    }
    // Each directive's own rule-code list runs from right after it up to wherever the
    // *next* directive in the same comment starts (or the end of the comment) - so two
    // directives mixed in one comment don't bleed their codes into each other.
    const matches = [...comment.matchAll(SUPPRESS_RE)];
    for (let m = 0; m < matches.length; m++) {
      const match = matches[m];
      const restStart = (match.index ?? 0) + match[0].length;
      const restEnd = matches[m + 1]?.index ?? comment.length;
      const targetLine = match[1].toLowerCase() === 'next-line' ? i + 1 : i;
      if (targetLine < lines.length) {
        mergeSuppression(
          map,
          targetLine,
          ruleTokensFrom(comment.slice(restStart, restEnd)),
        );
      }
    }
  }
  return map;
}

function isSuppressed(
  diagnostic: vscode.Diagnostic,
  suppressions: SuppressionMap,
): boolean {
  const entry = suppressions.get(diagnostic.range.start.line);
  if (!entry) {
    return false;
  }
  return (
    entry === 'all' ||
    (typeof diagnostic.code === 'string' && entry.has(diagnostic.code))
  );
}

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
    const diag = new vscode.Diagnostic(
      new vscode.Range(lineNo, targetCol, lineNo, targetCol + target.length),
      vscode.l10n.t("Cannot find a definition for label '{0}'.", target),
      vscode.DiagnosticSeverity.Warning,
    );
    diag.code = DIAGNOSTIC_RULES.UnresolvedLabel;
    diagnostics.push(diag);
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
    const diag = new vscode.Diagnostic(
      new vscode.Range(lineNo, start, lineNo, start + match[0].length),
      vscode.l10n.t(
        "Indirect addressing '{0}' is invalid - only @R0 and @R1 are addressable.",
        match[0],
      ),
      vscode.DiagnosticSeverity.Error,
    );
    diag.code = DIAGNOSTIC_RULES.InvalidIndirect;
    diagnostics.push(diag);
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
    const diag = new vscode.Diagnostic(
      new vscode.Range(
        lineNo,
        mnemonicCol,
        lineNo,
        mnemonicCol + mnemonicToken.length,
      ),
      vscode.l10n.t("Unknown instruction or directive '{0}'.", mnemonicToken),
      vscode.DiagnosticSeverity.Warning,
    );
    diag.code = DIAGNOSTIC_RULES.UnknownInstruction;
    diagnostics.push(diag);
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
      const diag = new vscode.Diagnostic(
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
      );
      diag.code = DIAGNOSTIC_RULES.OperandCount;
      diagnostics.push(diag);
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
    const diag = new vscode.Diagnostic(
      new vscode.Range(end.line, 0, end.line, lines[end.line].length),
      unmatchedEndMessage(end.keyword),
      vscode.DiagnosticSeverity.Error,
    );
    diag.code = DIAGNOSTIC_RULES.UnmatchedEnd;
    diagnostics.push(diag);
  }

  for (const frame of unclosed) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(frame.line, 0, frame.line, lines[frame.line].length),
      vscode.l10n.t("'{0}' block is never closed.", frame.kind),
      vscode.DiagnosticSeverity.Error,
    );
    diag.code = DIAGNOSTIC_RULES.UnclosedBlock;
    diagnostics.push(diag);
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
        const diag = new vscode.Diagnostic(
          new vscode.Range(
            def.line,
            def.character,
            def.line,
            def.character + def.length,
          ),
          vscode.l10n.t("Symbol '{0}' is defined more than once.", def.name),
          vscode.DiagnosticSeverity.Error,
        );
        diag.code = DIAGNOSTIC_RULES.DuplicateSymbol;
        diagnostics.push(diag);
      }
    }
  }
}

export function buildDiagnostics(
  doc: vscode.TextDocument,
  options?: DiagnosticsOptions,
): vscode.Diagnostic[] {
  const opts = options ?? resolveOptions(doc);
  if (!opts.enabled) {
    return [];
  }

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

  const suppressions = collectSuppressions(allLines);
  return diagnostics.filter((d) => {
    if (isSuppressed(d, suppressions)) {
      return false;
    }

    const override =
      typeof d.code === 'string' ? opts.severity[d.code] : undefined;
    if (override === 'off') {
      return false;
    }

    if (override) {
      d.severity = SEVERITY_VALUES[override];
    }

    return true;
  });
}
