import * as vscode from 'vscode';
import { indexDocument, SymbolKind } from '../language/symbolIndex';
import { lookupOpcodeEntry } from '../language/opcodeTable';
import {
  matchEncoding,
  renderHoverMarkdown,
  splitTopLevelOperands,
} from '../language/hoverLogic';
import { getCatalog, resolveLocale } from '../language/locales';
import {
  ASSIGN_DEF_RE,
  LABEL_DEF_RE,
  MACRO_DEF_RE,
  MNEMONIC_RE,
  findEndLineIndex,
  stripComment,
} from '../language/parsing';

const IDENT_RE = /[A-Za-z_?][A-Za-z0-9_?]*/;

function findEnclosingLabel(
  document: vscode.TextDocument,
  fromLine: number,
): string | undefined {
  for (let line = fromLine; line >= 0; line--) {
    const text = stripComment(document.lineAt(line).text);
    const match = LABEL_DEF_RE.exec(text);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export class A51HoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position, IDENT_RE);
    if (!wordRange) {
      return undefined;
    }

    const lines: string[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      lines.push(document.lineAt(line).text);
    }
    const endIdx = findEndLineIndex(lines);
    if (endIdx !== -1 && position.line > endIdx) {
      return undefined; // past a top-level END - A51 stops assembling there.
    }

    const lineText = document.lineAt(position.line).text;
    const text = stripComment(lineText);

    let rest = text;
    let col = 0;
    const labelMatch = LABEL_DEF_RE.exec(text);
    if (labelMatch) {
      rest = labelMatch[2];
      col = text.length - rest.length;
    } else if (ASSIGN_DEF_RE.exec(text) ?? MACRO_DEF_RE.exec(text)) {
      return undefined; // "NAME EQU/SET/.../MACRO" lines are definitions, not instructions.
    }

    const mnemonicMatch = MNEMONIC_RE.exec(rest);
    if (!mnemonicMatch || !mnemonicMatch[1]) {
      return undefined;
    }
    const mnemonicToken = mnemonicMatch[1];
    const mnemonicCol = col + rest.indexOf(mnemonicToken);
    const mnemonicRange = new vscode.Range(
      position.line,
      mnemonicCol,
      position.line,
      mnemonicCol + mnemonicToken.length,
    );

    if (
      wordRange.start.line !== position.line ||
      wordRange.start.character !== mnemonicRange.start.character ||
      wordRange.end.character !== mnemonicRange.end.character
    ) {
      return undefined; // hovering over something other than this line's mnemonic.
    }

    const mnemonicUpper = mnemonicToken.toUpperCase();
    const operandText = (mnemonicMatch[2] ?? '').trim();

    const catalog = getCatalog(resolveLocale(vscode.env.language));

    if (mnemonicUpper === 'CALL') {
      return new vscode.Hover(
        new vscode.MarkdownString(catalog.ui.callPseudoInstruction),
        mnemonicRange,
      );
    }

    const entry = lookupOpcodeEntry(mnemonicUpper);
    if (!entry) {
      return undefined; // not a mnemonic we have opcode data for.
    }

    const operandTexts = splitTopLevelOperands(operandText);
    const index = indexDocument(document);
    const symbolKindOf = (name: string): SymbolKind | undefined =>
      index.get(name.toUpperCase())?.[0]?.kind;
    const match = matchEncoding(entry, operandTexts, symbolKindOf);

    const label = findEnclosingLabel(document, position.line);
    const markdown = renderHoverMarkdown(
      catalog,
      mnemonicUpper,
      operandText,
      entry,
      match,
      label,
    );

    return new vscode.Hover(new vscode.MarkdownString(markdown), mnemonicRange);
  }
}
