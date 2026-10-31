import * as vscode from 'vscode';

import {
  FormatOptions,
  findEndLineIndex,
  formatLines,
  formatText,
  splitWithTrailingNewline,
} from './formatCore';

function readOptions(doc: vscode.TextDocument): FormatOptions {
  const cfg = vscode.workspace.getConfiguration('a51', doc.uri);
  return {
    mnemonicColumn: cfg.get<number>('format.mnemonicColumn', 8),
    operandColumn: cfg.get<number>('format.operandColumn', 16),
    commentColumn: cfg.get<number>('format.commentColumn', 40),
    indentStyle: cfg.get('format.indentStyle', 'spaces'),
    tabSize: cfg.get<number>('format.tabSize', 8),
    longLabelStyle: cfg.get('format.longLabelStyle', 'newline'),
    caseStyle: cfg.get('format.caseStyle', 'preserve'),
    commaSpacing: cfg.get('format.commaSpacing', 'preserve'),
    semicolonSpacing: cfg.get('format.semicolonSpacing', 'preserve'),
    indentMacroBody: cfg.get<boolean>('format.indentMacroBody', false),
    maxBlankLines: cfg.get<number>('format.maxBlankLines', 1),
  };
}

function eolString(doc: vscode.TextDocument): string {
  return doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

export class A51FormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): vscode.TextEdit[] {
    const options = readOptions(document);
    const eol = eolString(document);
    const original = document.getText();
    const formatted = formatText(original, eol, options);

    if (formatted === original) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(original.length),
    );
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}

export class A51RangeFormattingProvider
  implements vscode.DocumentRangeFormattingEditProvider
{
  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.TextEdit[] {
    const options = readOptions(document);
    const eol = eolString(document);
    const fullText = document.getText();
    const { lines: allLines } = splitWithTrailingNewline(fullText, eol);

    const endIdx = findEndLineIndex(allLines);
    const startLine = range.start.line;
    let endLine =
      range.end.character === 0 && range.end.line > range.start.line
        ? range.end.line - 1
        : range.end.line;

    if (endIdx !== -1 && startLine > endIdx) {
      return []; // selection lies entirely after the file's END directive.
    }
    if (endIdx !== -1) {
      endLine = Math.min(endLine, endIdx);
    }
    endLine = Math.min(endLine, document.lineCount - 1);

    const selStart = new vscode.Position(startLine, 0);
    const selEnd = document.lineAt(endLine).rangeIncludingLineBreak.end;
    const selectedText = document.getText(new vscode.Range(selStart, selEnd));

    const { lines: selectedLines, hasTrailingNewline } =
      splitWithTrailingNewline(selectedText, eol);
    const formattedLines = formatLines(selectedLines, options);
    const formatted =
      formattedLines.join(eol) + (hasTrailingNewline ? eol : '');

    if (formatted === selectedText) {
      return [];
    }

    return [
      vscode.TextEdit.replace(new vscode.Range(selStart, selEnd), formatted),
    ];
  }
}
