import * as assert from 'assert';
import * as vscode from 'vscode';

import { A51RenameProvider } from '../providers/renameProvider';

function openDoc(text: string): Thenable<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({
    content: text,
    language: 'a51',
  });
}

suite('A51RenameProvider', () => {
  test('renames a label definition and every reference to it', async () => {
    const doc = await openDoc(
      ['LOOP:   NOP', '        SJMP    LOOP', '        END'].join('\n'),
    );
    const edit = new A51RenameProvider().provideRenameEdits(
      doc,
      new vscode.Position(0, 2),
      'TOP',
    );
    const edits = edit.get(doc.uri);
    assert.strictEqual(edits.length, 2);
    assert.ok(edits.every((e) => e.newText === 'TOP'));
    assert.deepStrictEqual(edits.map((e) => e.range.start.line).sort(), [0, 1]);
  });

  test('prepareRename rejects a built-in mnemonic', async () => {
    const doc = await openDoc(
      ['        MOV     A,#1', '        END'].join('\n'),
    );
    const provider = new A51RenameProvider();
    assert.throws(() => provider.prepareRename(doc, new vscode.Position(0, 9)));
  });

  test('provideRenameEdits rejects an invalid new name', async () => {
    const doc = await openDoc(['LOOP:   NOP', '        END'].join('\n'));
    const provider = new A51RenameProvider();
    assert.throws(() =>
      provider.provideRenameEdits(doc, new vscode.Position(0, 2), '1BAD'),
    );
  });

  test('a rename that only appears after a top-level END is not touched', async () => {
    const doc = await openDoc(
      ['LOOP:   NOP', '        END', 'LOOP:   NOP'].join('\n'),
    );
    const edit = new A51RenameProvider().provideRenameEdits(
      doc,
      new vscode.Position(0, 2),
      'TOP',
    );
    assert.strictEqual(edit.get(doc.uri).length, 1);
  });
});
