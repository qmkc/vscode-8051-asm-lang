import * as assert from 'assert';
import { classifyAssignKind, maskStringLiterals } from '../language/parsing';

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
    const input = "DB 'hi;there',\"a,b\"";
    const masked = maskStringLiterals(input);
    assert.strictEqual(masked.length, input.length);
    assert.strictEqual(masked, `DB '${' '.repeat(8)}',"${' '.repeat(3)}"`);
  });

  test('text outside of string literals is left untouched', () => {
    assert.strictEqual(maskStringLiterals('MOV A,R0'), 'MOV A,R0');
  });
});
