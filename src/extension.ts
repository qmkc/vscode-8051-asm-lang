import * as vscode from 'vscode';

import { buildDiagnostics } from './providers/diagnostics';
import { A51DefinitionProvider } from './providers/definitionProvider';
import {
  A51FormattingProvider,
  A51RangeFormattingProvider,
} from './formatting/formatter';
import { A51CompletionProvider } from './providers/completionProvider';
import { A51HoverProvider } from './providers/hoverProvider';
import { A51DocumentSymbolProvider } from './providers/documentSymbolProvider';
import { A51FoldingRangeProvider } from './providers/foldingProvider';
import { A51ReferenceProvider } from './providers/referenceProvider';

const LANGUAGE_ID = 'a51';

export function activate(context: vscode.ExtensionContext): void {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  context.subscriptions.push(diagnosticCollection);

  const refreshDiagnostics = (doc: vscode.TextDocument) => {
    if (doc.languageId !== LANGUAGE_ID) {
      return;
    }
    diagnosticCollection.set(doc.uri, buildDiagnostics(doc));
  };

  if (vscode.window.activeTextEditor) {
    refreshDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((e) =>
      refreshDiagnostics(e.document),
    ),
    vscode.workspace.onDidSaveTextDocument(refreshDiagnostics),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticCollection.delete(doc.uri),
    ),
    vscode.languages.registerDocumentFormattingEditProvider(
      LANGUAGE_ID,
      new A51FormattingProvider(),
    ),
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      LANGUAGE_ID,
      new A51RangeFormattingProvider(),
    ),
    vscode.languages.registerDefinitionProvider(
      LANGUAGE_ID,
      new A51DefinitionProvider(),
    ),
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      new A51CompletionProvider(),
    ),
    vscode.languages.registerHoverProvider(LANGUAGE_ID, new A51HoverProvider()),
    vscode.languages.registerDocumentSymbolProvider(
      LANGUAGE_ID,
      new A51DocumentSymbolProvider(),
    ),
    vscode.languages.registerFoldingRangeProvider(
      LANGUAGE_ID,
      new A51FoldingRangeProvider(),
    ),
    vscode.languages.registerReferenceProvider(
      LANGUAGE_ID,
      new A51ReferenceProvider(),
    ),
  );
}

export function deactivate(): void {
  // No teardown required.
}
