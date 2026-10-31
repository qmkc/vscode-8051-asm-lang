import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_FORMAT_OPTIONS,
  FormatOptions,
  formatText,
} from '../formatting/formatCore';

function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name),
    'utf8',
  );
}

function fmt(
  text: string,
  overrides: Partial<FormatOptions> = {},
  eol = '\n',
): string {
  return formatText(text, eol, { ...DEFAULT_FORMAT_OPTIONS, ...overrides });
}

function assertIdempotent(
  text: string,
  overrides: Partial<FormatOptions> = {},
  eol = '\n',
): void {
  const once = fmt(text, overrides, eol);
  const twice = fmt(once, overrides, eol);
  assert.strictEqual(
    twice,
    once,
    'formatting a formatted file must be a no-op',
  );
}

suite('formatCore: golden cases', () => {
  test('aligns label, mnemonic, operand, comment to the configured columns', () => {
    const input =
      ['LOOP1:  SETB    LED', '        LCALL   DELAY   ;go'].join('\n') + '\n';
    const expected =
      [
        'LOOP1:  SETB    LED',
        '        LCALL   DELAY                   ;go',
      ].join('\n') + '\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('long label splits onto its own line by default', () => {
    const input = 'SOME_VERY_LONG_LABEL: MOV A,#1\n';
    const expected = 'SOME_VERY_LONG_LABEL:\n        MOV     A,#1\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('long label stays on the same line when longLabelStyle is sameLine', () => {
    const input = 'SOME_VERY_LONG_LABEL: MOV A,#1\n';
    const expected = 'SOME_VERY_LONG_LABEL: MOV A,#1\n';
    assert.strictEqual(fmt(input, { longLabelStyle: 'sameLine' }), expected);
    assertIdempotent(input, { longLabelStyle: 'sameLine' });
  });

  test('EQU/SET/BIT definitions without a colon are aligned like label lines', () => {
    const input = 'LED equ P1.0\n';
    const expected = 'LED     equ     P1.0\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('a colon-less symbol definition never splits, even if the name overruns the mnemonic column', () => {
    const input = 'VERY_LONG_SYMBOL_NAME EQU 40H\n?PR?TEST SEGMENT CODE\n';
    const expected = 'VERY_LONG_SYMBOL_NAME EQU 40H\n?PR?TEST SEGMENT CODE\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('a colon-less MACRO definition never splits either', () => {
    const input = 'A_VERY_LONG_MACRO_NAME MACRO\n';
    const expected = 'A_VERY_LONG_MACRO_NAME MACRO\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('operands split on top-level commas only, trimmed, and rejoined per commaSpacing', () => {
    const input = 'MOV R1 , R2\n';
    assert.strictEqual(fmt(input), '        MOV     R1,R2\n');
    assert.strictEqual(
      fmt(input, { commaSpacing: 'space' }),
      '        MOV     R1, R2\n',
    );
    assertIdempotent(input);
    assertIdempotent(input, { commaSpacing: 'space' });
  });

  test('commas inside parens are not split points', () => {
    const input = '$INCLUDE (REG51.INC)\nDB (1,2,3),4\n';
    const result = fmt(input);
    assert.ok(result.includes('(REG51.INC)'));
    assert.ok(result.includes('(1,2,3),4'));
    assertIdempotent(input);
  });

  test('a double-quoted comment delimiter is also respected when splitting off a comment', () => {
    const input = '        DB      "a;b,c"\n';
    assert.strictEqual(fmt(input), input);
    assertIdempotent(input);
  });

  test('semicolons inside string/char literals are not treated as comments', () => {
    const input = "        DB      'a;b,c'\n";
    assert.strictEqual(fmt(input), input);
    assertIdempotent(input);
  });

  test('$ control statements are pinned to column 0', () => {
    const input = '        $NOMOD51\n    $INCLUDE (REG51.INC)\n';
    const expected = '$NOMOD51\n$INCLUDE (REG51.INC)\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('content after a top-level END is preserved byte-for-byte', () => {
    const input =
      '        MOV     A,#1\n        END\n   garbage ; left alone\n\n\n';
    const result = fmt(input);
    assert.strictEqual(
      result,
      '        MOV     A,#1\n        END\n   garbage ; left alone\n\n\n',
    );
    assertIdempotent(input);
  });

  test('CRLF line endings are preserved', () => {
    const input = 'MAIN:   MOV     A,#1\r\n        RET\r\n';
    const result = fmt(input, {}, '\r\n');
    assert.strictEqual(result, input);
    assert.ok(result.includes('\r\n'));
    assert.ok(!/[^\r]\n/.test(result));
    assertIdempotent(input, {}, '\r\n');
  });

  test('mixed tab/space indentation input is reformatted consistently', () => {
    const input = '\tMOV\tA,#1\n  MOV  B,#2\n';
    const expected = '        MOV     A,#1\n        MOV     B,#2\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('indented full-line comments align to the mnemonic column; banners stay put', () => {
    const input =
      [
        ';;;;;;;;;;;;;;;;;;;;;;;;',
        '; top-level comment',
        '    ; indented comment',
        ';==== banner ====',
      ].join('\n') + '\n';
    const expected =
      [
        ';;;;;;;;;;;;;;;;;;;;;;;;',
        '; top-level comment',
        '        ; indented comment',
        ';==== banner ====',
      ].join('\n') + '\n';
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });

  test('operand text overflowing into the comment column gets a single separating space', () => {
    const input = 'MOV A,#THIS_IS_A_VERY_LONG_OPERAND_NAME_INDEED ;note\n';
    const result = fmt(input);
    assert.ok(
      result.includes('A,#THIS_IS_A_VERY_LONG_OPERAND_NAME_INDEED ;note'),
    );
    assertIdempotent(input);
  });

  test('blank lines collapse to the configured maximum', () => {
    const input = 'MOV A,#1\n\n\n\n\nMOV A,#2\n';
    const result = fmt(input, { maxBlankLines: 1 });
    assert.strictEqual(
      result,
      '        MOV     A,#1\n\n        MOV     A,#2\n',
    );
    assertIdempotent(input, { maxBlankLines: 1 });
  });

  test('tabs indentStyle uses real tab stops', () => {
    const input = 'MAIN: MOV A,#1\n';
    const result = fmt(input, { indentStyle: 'tabs', tabSize: 8 });
    assert.strictEqual(result, 'MAIN:\tMOV\tA,#1\n');
    assertIdempotent(input, { indentStyle: 'tabs', tabSize: 8 });
  });

  test('caseStyle upper normalizes mnemonics and known registers but not user symbols', () => {
    const input = 'delay: mov r7,#myConst\n';
    const result = fmt(input, { caseStyle: 'upper' });
    assert.strictEqual(result, 'delay:  MOV     R7,#myConst\n');
    assertIdempotent(input, { caseStyle: 'upper' });
  });

  test('a leading 0 in a hex literal is never dropped', () => {
    const input = 'MOV R6,#0FFH\n';
    assert.strictEqual(fmt(input), '        MOV     R6,#0FFH\n');
    assertIdempotent(input);
  });

  test('unparsable lines are left alone rather than guessed at', () => {
    const input = '%%% not valid asm %%%\n';
    assert.strictEqual(fmt(input), input);
    assertIdempotent(input);
  });

  test('format-stress fixture: a full file matches its golden output and is idempotent', () => {
    const input = readFixture('format-stress.input.a51');
    const expected = readFixture('format-stress.expected.a51');
    assert.strictEqual(fmt(input), expected);
    assertIdempotent(input);
  });
});
