import * as assert from 'assert';
import * as vscode from 'vscode';

import { indexDocument } from '../language/symbolIndex';

/** A minimal fake TextDocument - indexDocument only ever touches lineCount and lineAt(line).text. */
function fakeDocument(text: string): vscode.TextDocument {
  const lines = text.split('\n');
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] }) as vscode.TextLine,
  } as unknown as vscode.TextDocument;
}

suite('symbolIndex: indexDocument', () => {
  test('a label picks up the comment block directly above it as its doc', () => {
    const doc = fakeDocument(
      [
        '; Blinks the status LED once per second.',
        '; Call after SETUP.',
        'BLINK: SETB LED',
      ].join('\n'),
    );
    const def = indexDocument(doc).get('BLINK')?.[0];
    assert.ok(def);
    assert.strictEqual(
      def!.doc,
      'Blinks the status LED once per second.\nCall after SETUP.',
    );
  });

  test('a colon-less EQU/SET/BIT definition captures its value expression as detail', () => {
    const doc = fakeDocument('LED     BIT     P1.0\nCOUNT   EQU     30H\n');
    const index = indexDocument(doc);
    assert.strictEqual(index.get('LED')?.[0].detail, 'P1.0');
    assert.strictEqual(index.get('COUNT')?.[0].detail, '30H');
  });

  test('a MACRO definition captures its parameter list as detail', () => {
    const doc = fakeDocument(
      'DELAYM  MACRO   N\n        MOV     R7,#N\n        ENDM\n',
    );
    const def = indexDocument(doc).get('DELAYM')?.[0];
    assert.strictEqual(def?.kind, 'macro');
    assert.strictEqual(def?.detail, 'N');
  });

  test('a definition with no comment above it has no doc', () => {
    const doc = fakeDocument('NOP\nBLINK: SETB LED\n');
    assert.strictEqual(indexDocument(doc).get('BLINK')?.[0].doc, undefined);
  });

  test('indexing stops at a top-level END - nothing after it is captured', () => {
    const doc = fakeDocument('MAIN: NOP\nEND\nGHOST: NOP\n');
    const index = indexDocument(doc);
    assert.ok(index.has('MAIN'));
    assert.ok(!index.has('GHOST'));
  });
});
