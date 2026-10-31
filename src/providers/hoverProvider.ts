import * as vscode from 'vscode';

import { indexDocument, SymbolDef, SymbolKind } from '../language/symbolIndex';
import { lookupOpcodeEntry } from '../language/opcodeTable';
import {
  matchEncoding,
  renderHoverMarkdown,
  renderSymbolHoverMarkdown,
  splitTopLevelOperands,
} from '../language/hoverLogic';
import { getCatalog, LocaleCatalog, resolveLocale } from '../language/locales';
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

    const catalog = getCatalog(resolveLocale(vscode.env.language));
    const index = indexDocument(document);

    return (
      this.tryMnemonicHover(document, position, wordRange, catalog, index) ??
      this.trySymbolHover(document, wordRange, catalog, index)
    );
  }

  /** Hover for the line's own mnemonic (built-in opcode reference, or the `CALL` pseudo-instruction note). */
  private tryMnemonicHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    wordRange: vscode.Range,
    catalog: LocaleCatalog,
    index: Map<string, SymbolDef[]>,
  ): vscode.Hover | undefined {
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

    if (mnemonicUpper === 'CALL') {
      return new vscode.Hover(
        new vscode.MarkdownString(catalog.ui.callPseudoInstruction),
        mnemonicRange,
      );
    }

    const entry = lookupOpcodeEntry(mnemonicUpper);
    if (!entry) {
      return undefined; // not a mnemonic we have opcode data for - maybe a macro call.
    }

    const operandTexts = splitTopLevelOperands(operandText);
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

  /** Hover for a bare reference to a label/EQU/SET/BIT/data/macro symbol - its kind, value/params, defining line, and the doc comment directly above its definition, if any. */
  private trySymbolHover(
    document: vscode.TextDocument,
    wordRange: vscode.Range,
    catalog: LocaleCatalog,
    index: Map<string, SymbolDef[]>,
  ): vscode.Hover | undefined {
    const word = document.getText(wordRange);
    const defs = index.get(word.toUpperCase());
    if (!defs || defs.length === 0) {
      return undefined;
    }

    const markdown = renderSymbolHoverMarkdown(catalog, defs[0]);
    return new vscode.Hover(new vscode.MarkdownString(markdown), wordRange);
  }
}
