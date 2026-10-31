import * as assert from 'assert';

import { matchBlocks } from '../language/blockMatcher';

suite('blockMatcher', () => {
  test('matches a simple IF/ENDIF pair', () => {
    const { matched, unmatchedEnds, unclosed } = matchBlocks([
      'IF COND',
      '  MOV A,#1',
      'ENDIF',
    ]);
    assert.deepStrictEqual(matched, [{ kind: 'IF', startLine: 0, endLine: 2 }]);
    assert.strictEqual(unmatchedEnds.length, 0);
    assert.strictEqual(unclosed.length, 0);
  });

  test('matches nested MACRO/REPT/WHILE blocks innermost-first', () => {
    const { matched, unmatchedEnds, unclosed } = matchBlocks([
      'DELAY MACRO',
      '  REPT 3',
      '    WHILE COND',
      '    ENDW',
      '  ENDM',
      'ENDM',
    ]);
    assert.deepStrictEqual(matched, [
      { kind: 'WHILE', startLine: 2, endLine: 3 },
      { kind: 'REPT', startLine: 1, endLine: 4 },
      { kind: 'MACRO', startLine: 0, endLine: 5 },
    ]);
    assert.strictEqual(unmatchedEnds.length, 0);
    assert.strictEqual(unclosed.length, 0);
  });

  test('reports an ENDIF with no matching IF', () => {
    const { matched, unmatchedEnds } = matchBlocks(['ENDIF']);
    assert.strictEqual(matched.length, 0);
    assert.deepStrictEqual(unmatchedEnds, [{ keyword: 'ENDIF', line: 0 }]);
  });

  test('reports a block that is never closed', () => {
    const { unclosed } = matchBlocks(['IF COND', 'MOV A,#1']);
    assert.deepStrictEqual(unclosed, [{ kind: 'IF', line: 0 }]);
  });

  test('ENDM does not close a WHILE block', () => {
    const { unmatchedEnds, unclosed } = matchBlocks(['WHILE COND', 'ENDM']);
    assert.deepStrictEqual(unmatchedEnds, [{ keyword: 'ENDM', line: 1 }]);
    assert.deepStrictEqual(unclosed, [{ kind: 'WHILE', line: 0 }]);
  });

  test('ignores keywords that appear only inside a comment', () => {
    const { matched } = matchBlocks([
      'IF COND ; ENDIF mentioned here',
      'ENDIF',
    ]);
    assert.deepStrictEqual(matched, [{ kind: 'IF', startLine: 0, endLine: 1 }]);
  });
});
