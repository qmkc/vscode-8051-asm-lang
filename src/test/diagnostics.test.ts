import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildDiagnostics } from '../providers/diagnostics';

/** A minimal fake TextDocument - buildDiagnostics only ever touches lineCount and lineAt(line).text. */
function fakeDocument(text: string): vscode.TextDocument {
  const lines = text.split('\n');
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] }) as vscode.TextLine,
  } as unknown as vscode.TextDocument;
}

suite('diagnostics: buildDiagnostics and the top-level END boundary', () => {
  test('an unknown mnemonic before END is flagged', () => {
    const doc = fakeDocument(
      ['        FOOBAR  A,#1', '        END'].join('\n'),
    );
    const diagnostics = buildDiagnostics(doc);
    assert.strictEqual(diagnostics.length, 1);
    assert.ok(diagnostics[0].message.includes('FOOBAR'));
  });

  test('garbage text after a top-level END is never diagnosed', () => {
    const doc = fakeDocument(
      [
        '        MOV     A,#1',
        '        END',
        'this is not assembly at all',
      ].join('\n'),
    );
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });

  test('a second definition of a symbol that only appears after END is not a duplicate', () => {
    const doc = fakeDocument(
      ['LOOP:   NOP', '        END', 'LOOP:   NOP'].join('\n'),
    );
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });

  test('an unclosed MACRO/IF/REPT/WHILE block is still reported when END never appears', () => {
    const doc = fakeDocument(['IF COND', '  MOV A,#1'].join('\n'));
    const diagnostics = buildDiagnostics(doc);
    assert.strictEqual(diagnostics.length, 1);
    assert.ok(diagnostics[0].message.includes('IF'));
  });
});
