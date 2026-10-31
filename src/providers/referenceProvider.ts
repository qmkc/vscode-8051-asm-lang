import * as vscode from 'vscode';

import { indexDocument } from '../language/symbolIndex';
import {
  findEndLineIndex,
  maskStringLiterals,
  splitCodeAndComment,
} from '../language/parsing';

const WORD_RE = /[A-Za-z_?][A-Za-z0-9_?]*/;
const IDENT_RE = /[A-Za-z_?][A-Za-z0-9_?]*/g;

export class A51ReferenceProvider implements vscode.ReferenceProvider {
  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
  ): vscode.Location[] | undefined {
    const wordRange = document.getWordRangeAtPosition(position, WORD_RE);
    if (!wordRange) {
      return undefined;
    }
    const word = document.getText(wordRange).toUpperCase();

    const index = indexDocument(document);
    if (!index.has(word)) {
      return undefined;
    }

    const lines: string[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      lines.push(document.lineAt(line).text);
    }
    // A51 stops assembling at a top-level END - nothing after it is a real reference.
    const endIdx = findEndLineIndex(lines);
    const lastLine = endIdx === -1 ? lines.length - 1 : endIdx;

    const locations: vscode.Location[] = [];
    for (let line = 0; line <= lastLine; line++) {
      const { code } = splitCodeAndComment(lines[line]);
      const scanText = maskStringLiterals(code);
      for (const match of scanText.matchAll(IDENT_RE)) {
        if (match[0].toUpperCase() !== word) {
          continue;
        }
        const start = match.index ?? 0;
        locations.push(
          new vscode.Location(
            document.uri,
            new vscode.Range(line, start, line, start + match[0].length),
          ),
        );
      }
    }

    if (context.includeDeclaration) {
      return locations;
    }

    const defLines = new Set(
      (index.get(word) ?? []).map((def) => `${def.line}:${def.character}`),
    );
    return locations.filter(
      (loc) =>
        !defLines.has(`${loc.range.start.line}:${loc.range.start.character}`),
    );
  }
}
