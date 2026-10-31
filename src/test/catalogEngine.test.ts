import * as assert from 'assert';
import { buildCatalog, LocaleData } from '../language/locales/catalogEngine';

function minimalData(overrides: Partial<LocaleData> = {}): LocaleData {
  return {
    notes: { atRi: 'note text' },
    describeOperand: {
      A: 'A',
      B: 'B',
      C: 'the carry flag',
      AB: 'AB',
      DPTR: 'DPTR',
      '@DPTR': '@DPTR',
      '@A+DPTR': '@A+DPTR',
      '@A+PC': '@A+PC',
      Rn: 'register {0}',
      '@Ri': 'indirect {0}',
      bit: 'bit {0}',
      notbit: 'not-bit {0}',
      data: 'data {0}',
      data16: 'data16 {0}',
      direct: '{0}',
      rel: '{0}',
    },
    ui: {
      headingWithLabel: '{0} in {1}',
      headingNoLabel: '{0}',
      opcodeTableHeader: 'OPCODE_HEADER',
      operandTableHeader: 'OPERAND_HEADER',
      flagsLabel: 'Flags: {0}',
      noMatchIntro: 'no match for {1} on {0}',
      noneOperand: '(none)',
      byteUnitOne: '{0} byte',
      byteUnitMany: '{0} bytes',
      callPseudoInstruction: 'CALL note',
      symbolKindLabel: {
        label: 'label',
        equ: 'equ',
        set: 'set',
        bit: 'bit',
        data: 'data',
        macro: 'macro',
      },
      definedAtLine: 'defined at {0}',
    },
    instructions: {
      ADD: {
        description: 'adds',
        flags: 'Cy',
        explain: 'add {1} to A',
      },
      ANL: {
        description: 'ands',
        flags: 'none',
        explain: {
          default: '{0} AND {1}',
          whenFirstType: { C: 'AND {1} into carry' },
        },
      },
    },
    ...overrides,
  };
}

suite('catalogEngine: buildCatalog', () => {
  test('describeOperand applies the Rn/@Ri uppercase and notbit slice transforms', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(catalog.describeOperand('r7', 'Rn'), 'register R7');
    assert.strictEqual(catalog.describeOperand('r0', '@Ri'), 'indirect R0');
    assert.strictEqual(
      catalog.describeOperand('/LED', 'notbit'),
      'not-bit LED',
    );
    assert.strictEqual(catalog.describeOperand('LED', 'bit'), 'bit LED');
  });

  test('a plain string explain template substitutes positionally', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(
      catalog.instructions.ADD.explain(['A', '#5'], ['A', 'data']),
      'add #5 to A',
    );
  });

  test('an object explain spec uses the override when the first operand type matches', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(
      catalog.instructions.ANL.explain(['the carry flag', 'LED'], ['C', 'bit']),
      'AND LED into carry',
    );
  });

  test('an object explain spec falls back to default when the first operand type does not match', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(
      catalog.instructions.ANL.explain(['A', 'R1'], ['A', 'Rn']),
      'A AND R1',
    );
  });

  test('ui.heading picks the with/without-label template', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(catalog.ui.heading('MOV A,R0', 'LOOP'), 'MOV A,R0 in LOOP');
    assert.strictEqual(catalog.ui.heading('MOV A,R0', undefined), 'MOV A,R0');
  });

  test('ui.byteUnit picks the singular/plural template', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(catalog.ui.byteUnit(1), '1 byte');
    assert.strictEqual(catalog.ui.byteUnit(3), '3 bytes');
  });

  test('ui.symbolKindLabel and ui.definedAtLine are simple lookups/substitutions', () => {
    const catalog = buildCatalog('en', minimalData());
    assert.strictEqual(catalog.ui.symbolKindLabel('macro'), 'macro');
    assert.strictEqual(catalog.ui.definedAtLine(42), 'defined at 42');
  });

  test('notes and the catalog code pass through unchanged', () => {
    const catalog = buildCatalog('zh-tw', minimalData());
    assert.strictEqual(catalog.code, 'zh-tw');
    assert.strictEqual(catalog.notes.atRi, 'note text');
  });
});
