import * as assert from 'assert';

import {
  classifyAssignKind,
  extractDocComment,
  isBannerComment,
  maskStringLiterals,
} from '../language/parsing';

suite('parsing: classifyAssignKind', () => {
  test('EQU, SET, and BIT keep their own distinct kind', () => {
    assert.strictEqual(classifyAssignKind('EQU'), 'equ');
    assert.strictEqual(classifyAssignKind('set'), 'set');
    assert.strictEqual(classifyAssignKind('Bit'), 'bit');
  });

  test('DATA/IDATA/XDATA/CODE/DBIT/SEGMENT are all grouped under data', () => {
    for (const directive of [
      'DATA',
      'IDATA',
      'XDATA',
      'CODE',
      'DBIT',
      'SEGMENT',
    ]) {
      assert.strictEqual(classifyAssignKind(directive), 'data');
    }
  });
});

suite('parsing: maskStringLiterals', () => {
  test('blanks out the contents of single- and double-quoted strings, preserving length', () => {
    const input = 'DB \'hi;there\',"a,b"';
    const masked = maskStringLiterals(input);
    assert.strictEqual(masked.length, input.length);
    assert.strictEqual(masked, `DB '${' '.repeat(8)}',"${' '.repeat(3)}"`);
  });

  test('text outside of string literals is left untouched', () => {
    assert.strictEqual(maskStringLiterals('MOV A,R0'), 'MOV A,R0');
  });
});

suite('parsing: isBannerComment', () => {
  test('a divider made only of punctuation is a banner', () => {
    assert.ok(isBannerComment(';;;;;;;;;;;;'));
    assert.ok(isBannerComment(';===================='));
    assert.ok(isBannerComment(';---'));
  });

  test('ordinary prose, including a divider with words in it, is not a banner', () => {
    assert.ok(!isBannerComment('; this delays for ~10ms'));
    assert.ok(!isBannerComment(';==== section ===='));
    assert.ok(!isBannerComment(';'));
  });
});

suite('parsing: extractDocComment', () => {
  test('collects the contiguous comment block directly above the definition line', () => {
    const lines = [
      '; Blinks the status LED once per second.',
      '; Call after SETUP.',
      'BLINK: SETB LED',
    ];
    assert.strictEqual(
      extractDocComment(lines, 2),
      'Blinks the status LED once per second.\nCall after SETUP.',
    );
  });

  test('stops at a blank line', () => {
    const lines = ['; unrelated comment', '', 'BLINK: SETB LED'];
    assert.strictEqual(extractDocComment(lines, 2), undefined);
  });

  test('stops at a banner/divider line', () => {
    const lines = [
      ';====================',
      '; real doc comment',
      'BLINK: SETB LED',
    ];
    assert.strictEqual(extractDocComment(lines, 2), 'real doc comment');
  });

  test('returns undefined when there is no comment directly above', () => {
    const lines = ['NOP', 'BLINK: SETB LED'];
    assert.strictEqual(extractDocComment(lines, 1), undefined);
  });

  test('returns undefined for a definition on the first line', () => {
    assert.strictEqual(extractDocComment(['BLINK: SETB LED'], 0), undefined);
  });
});
