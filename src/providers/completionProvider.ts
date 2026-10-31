import * as vscode from 'vscode';

import { indexDocument, SymbolKind } from '../language/symbolIndex';
import {
  DIRECTIVES,
  INSTRUCTIONS,
  REGISTERS,
} from '../language/instructionSet';
import { getCatalog, resolveLocale } from '../language/locales';

const SYMBOL_KIND_TO_COMPLETION_KIND: Record<
  SymbolKind,
  vscode.CompletionItemKind
> = {
  label: vscode.CompletionItemKind.Reference,
  equ: vscode.CompletionItemKind.Constant,
  set: vscode.CompletionItemKind.Constant,
  bit: vscode.CompletionItemKind.Variable,
  data: vscode.CompletionItemKind.Variable,
  macro: vscode.CompletionItemKind.Function,
};

function buildInstructionItems(): vscode.CompletionItem[] {
  const catalog = getCatalog(resolveLocale(vscode.env.language));
  return INSTRUCTIONS.map((instr) => {
    const item = new vscode.CompletionItem(
      instr.mnemonic,
      vscode.CompletionItemKind.Keyword,
    );
    item.detail = vscode.l10n.t(
      '{0} - {1} operand(s)',
      instr.mnemonic,
      instr.operands.join('/'),
    );
    // Prefer the fuller, localized opcode-reference description; fall back
    // to the English one-liner for mnemonics without opcode table data.
    item.documentation =
      catalog.instructions[instr.mnemonic]?.description ?? instr.summary;
    return item;
  });
}

const DIRECTIVE_ITEMS = DIRECTIVES.map(
  (directive) =>
    new vscode.CompletionItem(directive, vscode.CompletionItemKind.Keyword),
);

const REGISTER_ITEMS = REGISTERS.map(
  (register) =>
    new vscode.CompletionItem(register, vscode.CompletionItemKind.Variable),
);

export class A51CompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [
      ...buildInstructionItems(),
      ...DIRECTIVE_ITEMS,
      ...REGISTER_ITEMS,
    ];

    const index = indexDocument(document);
    for (const [name, defs] of index) {
      const def = defs[0];
      const item = new vscode.CompletionItem(
        name,
        SYMBOL_KIND_TO_COMPLETION_KIND[def.kind],
      );
      item.detail = vscode.l10n.t(
        '{0} - defined at line {1}',
        def.kind,
        def.line + 1,
      );
      items.push(item);
    }

    return items;
  }
}
