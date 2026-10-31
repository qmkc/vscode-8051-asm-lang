import * as vscode from 'vscode';

import { indexDocument, SymbolKind } from '../language/symbolIndex';

const SYMBOL_KIND_TO_VSCODE_KIND: Record<SymbolKind, vscode.SymbolKind> = {
  label: vscode.SymbolKind.Function,
  equ: vscode.SymbolKind.Constant,
  set: vscode.SymbolKind.Constant,
  bit: vscode.SymbolKind.Variable,
  data: vscode.SymbolKind.Variable,
  macro: vscode.SymbolKind.Module,
};

export class A51DocumentSymbolProvider
  implements vscode.DocumentSymbolProvider
{
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    const index = indexDocument(document);
    const symbols: vscode.DocumentSymbol[] = [];

    for (const defs of index.values()) {
      for (const def of defs) {
        const range = new vscode.Range(
          def.line,
          def.character,
          def.line,
          def.character + def.length,
        );
        symbols.push(
          new vscode.DocumentSymbol(
            def.name,
            def.kind,
            SYMBOL_KIND_TO_VSCODE_KIND[def.kind],
            range,
            range,
          ),
        );
      }
    }

    return symbols.sort((a, b) => a.range.start.line - b.range.start.line);
  }
}
