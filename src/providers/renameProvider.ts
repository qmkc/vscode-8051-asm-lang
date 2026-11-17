import * as vscode from 'vscode';

import { indexDocument } from '../language/symbolIndex';
import { WORD_RE, findOccurrences } from './referenceProvider';

const VALID_NAME_RE = /^[A-Za-z_?][A-Za-z0-9_?]*$/;

export class A51RenameProvider implements vscode.RenameProvider {
  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range {
    const { wordRange } = this.resolveSymbol(document, position);
    return wordRange;
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
  ): vscode.WorkspaceEdit {
    if (!VALID_NAME_RE.test(newName)) {
      throw new Error(
        vscode.l10n.t("'{0}' is not a valid A51 symbol name.", newName),
      );
    }
    const { word } = this.resolveSymbol(document, position);

    const edit = new vscode.WorkspaceEdit();
    for (const range of findOccurrences(document, word)) {
      edit.replace(document.uri, range, newName);
    }
    return edit;
  }

  /** The word at `position` and its range, or throws if it isn't a symbol defined in this file. */
  private resolveSymbol(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): { word: string; wordRange: vscode.Range } {
    const wordRange = document.getWordRangeAtPosition(position, WORD_RE);
    if (!wordRange) {
      throw new Error(vscode.l10n.t('Nothing to rename here.'));
    }
    const word = document.getText(wordRange).toUpperCase();
    if (!indexDocument(document).has(word)) {
      throw new Error(
        vscode.l10n.t(
          'Only a label, constant (EQU/SET/BIT/.../SEGMENT), or macro defined in this file can be renamed.',
        ),
      );
    }
    return { word, wordRange };
  }
}
