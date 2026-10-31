import * as vscode from 'vscode';

import { indexDocument } from '../language/symbolIndex';

const IDENT_RE = /[A-Za-z_?][A-Za-z0-9_?]*/;

export class A51DefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const range = document.getWordRangeAtPosition(position, IDENT_RE);
    if (!range) {
      return undefined;
    }
    const word = document.getText(range).toUpperCase();

    const index = indexDocument(document);
    const defs = index.get(word);
    if (!defs || defs.length === 0) {
      return undefined;
    }

    return defs.map(
      (def) =>
        new vscode.Location(
          document.uri,
          new vscode.Range(
            def.line,
            def.character,
            def.line,
            def.character + def.length,
          ),
        ),
    );
  }
}
