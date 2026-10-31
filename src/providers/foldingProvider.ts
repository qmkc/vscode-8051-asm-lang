import * as vscode from 'vscode';

import { matchBlocks } from '../language/blockMatcher';
import { findEndLineIndex } from '../language/parsing';

export class A51FoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    const lines: string[] = [];
    for (let line = 0; line < document.lineCount; line++) {
      lines.push(document.lineAt(line).text);
    }

    // A51 stops assembling at a top-level END - nothing after it is a real block.
    const endIdx = findEndLineIndex(lines);
    const foldableLines = endIdx === -1 ? lines : lines.slice(0, endIdx + 1);

    const { matched } = matchBlocks(foldableLines);
    return matched
      .filter((block) => block.endLine > block.startLine)
      .map((block) => new vscode.FoldingRange(block.startLine, block.endLine));
  }
}
