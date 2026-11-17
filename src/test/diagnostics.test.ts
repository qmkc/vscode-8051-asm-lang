import * as assert from 'assert';
import * as vscode from 'vscode';

import { buildDiagnostics, DIAGNOSTIC_RULES } from '../providers/diagnostics';

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

suite('diagnostics: the a51.diagnostics.enable/severity options', () => {
  test('enabled: false suppresses every diagnostic', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostics = buildDiagnostics(doc, {
      enabled: false,
      severity: {},
    });
    assert.deepStrictEqual(diagnostics, []);
  });

  test('a rule set to "off" is never reported, others still are', () => {
    const doc = fakeDocument(
      ['        FOOBAR  A,#1', '        MOV     A'].join('\n'),
    );
    const diagnostics = buildDiagnostics(doc, {
      enabled: true,
      severity: { [DIAGNOSTIC_RULES.UnknownInstruction]: 'off' },
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].code, DIAGNOSTIC_RULES.OperandCount);
  });

  test('a rule can have its severity overridden to error', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostics = buildDiagnostics(doc, {
      enabled: true,
      severity: { [DIAGNOSTIC_RULES.UnknownInstruction]: 'error' },
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(
      diagnostics[0].severity,
      vscode.DiagnosticSeverity.Error,
    );
  });

  test('each diagnostic carries its rule id as `code`', () => {
    const doc = fakeDocument('        FOOBAR  A,#1');
    const diagnostics = buildDiagnostics(doc, {
      enabled: true,
      severity: {},
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(
      diagnostics[0].code,
      DIAGNOSTIC_RULES.UnknownInstruction,
    );
  });
});

suite('diagnostics: a51-disable-line / a51-disable-next-line comments', () => {
  test('a51-disable-line suppresses every diagnostic on that line', () => {
    const doc = fakeDocument('        FOOBAR  A,#1 ; a51-disable-line');
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });

  test('a51-disable-next-line suppresses every diagnostic on the following line', () => {
    const doc = fakeDocument(
      ['        ; a51-disable-next-line', '        FOOBAR  A,#1'].join('\n'),
    );
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });

  test('naming a rule code only suppresses that rule, not others on the same line', () => {
    const doc = fakeDocument(
      `        FOOBAR  A,#1 ; a51-disable-line ${DIAGNOSTIC_RULES.OperandCount}`,
    );
    const diagnostics = buildDiagnostics(doc);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(
      diagnostics[0].code,
      DIAGNOSTIC_RULES.UnknownInstruction,
    );
  });

  test('a disable comment on an unrelated line has no effect', () => {
    const doc = fakeDocument(
      ['        ; a51-disable-line', '        FOOBAR  A,#1'].join('\n'),
    );
    const diagnostics = buildDiagnostics(doc);
    assert.strictEqual(diagnostics.length, 1);
  });

  test('rule codes in a disable comment are matched case-insensitively', () => {
    const doc = fakeDocument(
      `        FOOBAR  A,#1 ; a51-disable-line ${DIAGNOSTIC_RULES.UnknownInstruction.toLowerCase()}`,
    );
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });

  test('a comment mixing disable-line and disable-next-line attributes each code to its own directive, not the other', () => {
    const doc = fakeDocument(
      [
        `        MOV     A     ; a51-disable-line ${DIAGNOSTIC_RULES.OperandCount} a51-disable-next-line ${DIAGNOSTIC_RULES.UnknownInstruction}`,
        '        FOOBAR  A,#1',
      ].join('\n'),
    );
    // Without this, "a51-disable-line"'s capture swallows the whole rest of the comment,
    // so AS001 ends up (wrongly) suppressed on line 0 instead of line 1, and line 1's real
    // unknown-instruction diagnostic slips through unsuppressed.
    assert.deepStrictEqual(buildDiagnostics(doc), []);
  });
});
