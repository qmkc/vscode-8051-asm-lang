import * as assert from 'assert';
import {
  matchEncoding,
  renderHoverMarkdown,
  splitTopLevelOperands,
} from '../language/hoverLogic';
import { lookupOpcodeEntry } from '../language/opcodeTable';
import { getCatalog, resolveLocale } from '../language/locales';
import { SymbolKind } from '../language/symbolIndex';

function noSymbols(): SymbolKind | undefined {
  return undefined;
}

const en = getCatalog('en');
const zhTw = getCatalog('zh-tw');
const zhCn = getCatalog('zh-cn');

suite('locales: resolveLocale', () => {
  test('maps VS Code display-language tags to the right catalog', () => {
    assert.strictEqual(resolveLocale('en'), 'en');
    assert.strictEqual(resolveLocale('en-US'), 'en');
    assert.strictEqual(resolveLocale('ja'), 'en');
    assert.strictEqual(resolveLocale('zh-tw'), 'zh-tw');
    assert.strictEqual(resolveLocale('zh-TW'), 'zh-tw');
    assert.strictEqual(resolveLocale('zh-hant'), 'zh-tw');
    assert.strictEqual(resolveLocale('zh-hk'), 'zh-tw');
    assert.strictEqual(resolveLocale('zh-cn'), 'zh-cn');
    assert.strictEqual(resolveLocale('zh-hans'), 'zh-cn');
    assert.strictEqual(resolveLocale('zh'), 'zh-cn');
  });
});

suite('hoverLogic', () => {
  test("MOV @R0,A — the user's worked example: opcode, length, cycles, and the R0/R1 note (zh-tw)", () => {
    const entry = lookupOpcodeEntry('MOV');
    assert.ok(entry);
    const operands = splitTopLevelOperands('@R0,A');
    assert.deepStrictEqual(operands, ['@R0', 'A']);

    const match = matchEncoding(entry!, operands, noSymbols);
    assert.ok(match, 'expected an encoding match for MOV @R0,A');
    assert.strictEqual(match!.encoding.opcode, 'F6H-F7H');
    assert.strictEqual(match!.encoding.bytes, 1);
    assert.strictEqual(match!.encoding.cycles, 1);

    const md = renderHoverMarkdown(zhTw, 'MOV', '@R0,A', entry!, match, 'LOOP');
    assert.ok(md.includes('MOV @R0,A — 位於 LOOP'));
    assert.ok(md.includes('F6H-F7H'));
    assert.ok(
      md.includes('80H–FFH'),
      'expected the 8052 upper-RAM note for @Ri addressing',
    );
    assert.ok(md.includes('SFR'));
  });

  test('the same hover renders in English and Simplified Chinese too', () => {
    const entry = lookupOpcodeEntry('MOV')!;
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('@R0,A'),
      noSymbols,
    )!;

    const enMd = renderHoverMarkdown(en, 'MOV', '@R0,A', entry, match, 'LOOP');
    assert.ok(enMd.includes('MOV @R0,A — inside LOOP'));
    assert.ok(enMd.includes('Copy'));
    assert.ok(enMd.includes('SFR'));

    const cnMd = renderHoverMarkdown(
      zhCn,
      'MOV',
      '@R0,A',
      entry,
      match,
      'LOOP',
    );
    assert.ok(cnMd.includes('MOV @R0,A — 位于 LOOP'));
    assert.ok(cnMd.includes('复制'));
    assert.ok(cnMd.includes('寄存器') || cnMd.includes('存储器'));
  });

  test('MOV explain phrase follows dst ← src in every locale', () => {
    const entry = lookupOpcodeEntry('MOV')!;
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('@R0,A'),
      noSymbols,
    )!;
    const phrases = match.encoding.operands.map((t, i) =>
      zhTw.describeOperand(match.operandTexts[i], t),
    );
    assert.strictEqual(
      zhTw.instructions.MOV.explain(phrases),
      '把 累加器 A 的值複製到 @R0 所指向的內部 RAM（間接定址）。',
    );

    const enPhrases = match.encoding.operands.map((t, i) =>
      en.describeOperand(match.operandTexts[i], t),
    );
    assert.strictEqual(
      en.instructions.MOV.explain(enPhrases),
      'Copy the value of accumulator A into internal RAM pointed to by @R0 (indirect addressing).',
    );
  });

  test('ADD A,#data picks the immediate encoding', () => {
    const entry = lookupOpcodeEntry('ADD')!;
    const operands = splitTopLevelOperands('A,#5');
    const match = matchEncoding(entry, operands, noSymbols);
    assert.ok(match);
    assert.strictEqual(match!.encoding.opcode, '24H');
    assert.strictEqual(match!.encoding.bytes, 2);
  });

  test('MOV DPTR,#data16 is distinguished from the 8-bit #data forms', () => {
    const entry = lookupOpcodeEntry('MOV')!;
    const operands = splitTopLevelOperands('DPTR,#1234H');
    const match = matchEncoding(entry, operands, noSymbols);
    assert.ok(match);
    assert.strictEqual(match!.encoding.opcode, '90H');
    assert.strictEqual(match!.encoding.bytes, 3);
  });

  test('SETB bit vs SETB C are distinguished by the operand text', () => {
    const entry = lookupOpcodeEntry('SETB')!;
    const bitMatch = matchEncoding(
      entry,
      splitTopLevelOperands('LED'),
      noSymbols,
    );
    const carryMatch = matchEncoding(
      entry,
      splitTopLevelOperands('C'),
      noSymbols,
    );
    assert.strictEqual(bitMatch!.encoding.opcode, 'D2H');
    assert.strictEqual(carryMatch!.encoding.opcode, 'D3H');
  });

  test('a known bit symbol disambiguates CLR bit from a plain direct-only mnemonic context', () => {
    const entry = lookupOpcodeEntry('CLR')!;
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('LED'),
      () => 'bit',
    );
    assert.ok(match);
    assert.strictEqual(match!.encoding.opcode, 'C2H');
  });

  test('CJNE Rn,#data,rel resolves the three-operand register form', () => {
    const entry = lookupOpcodeEntry('CJNE')!;
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('R0,#0,LOOP'),
      noSymbols,
    );
    assert.ok(match);
    assert.strictEqual(match!.encoding.opcode, 'B8H-BFH');
    const phrases = match!.encoding.operands.map((t, i) =>
      zhTw.describeOperand(match!.operandTexts[i], t),
    );
    const explanation = zhTw.instructions.CJNE.explain(phrases);
    assert.ok(explanation.includes('LOOP'));
  });

  test('DJNZ Rn,rel vs DJNZ direct,rel', () => {
    const entry = lookupOpcodeEntry('DJNZ')!;
    const rnMatch = matchEncoding(
      entry,
      splitTopLevelOperands('R5,D2'),
      noSymbols,
    );
    const directMatch = matchEncoding(
      entry,
      splitTopLevelOperands('COUNT,D2'),
      noSymbols,
    );
    assert.strictEqual(rnMatch!.encoding.opcode, 'D8H-DFH');
    assert.strictEqual(directMatch!.encoding.opcode, 'D5H');
  });

  test('ACALL carries the page-boundary note', () => {
    const entry = lookupOpcodeEntry('ACALL')!;
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('SUBR'),
      noSymbols,
    );
    assert.ok(match);
    const md = renderHoverMarkdown(
      zhTw,
      'ACALL',
      'SUBR',
      entry,
      match,
      undefined,
    );
    assert.ok(md.includes('2KB'));
    const enMd = renderHoverMarkdown(
      en,
      'ACALL',
      'SUBR',
      entry,
      match,
      undefined,
    );
    assert.ok(enMd.includes('2KB'));
  });

  test('an unmatched operand combination falls back to listing every addressing mode', () => {
    const entry = lookupOpcodeEntry('MOV')!;
    // Not a real MOV form (two immediates)
    const match = matchEncoding(
      entry,
      splitTopLevelOperands('#1,#2'),
      noSymbols,
    );
    assert.strictEqual(match, undefined);
    const md = renderHoverMarkdown(
      zhTw,
      'MOV',
      '#1,#2',
      entry,
      match,
      undefined,
    );
    assert.ok(md.includes('找不到與'));
    assert.ok(md.includes('E8H')); // table still lists known encodings
    const enMd = renderHoverMarkdown(
      en,
      'MOV',
      '#1,#2',
      entry,
      match,
      undefined,
    );
    assert.ok(enMd.includes('No addressing mode matches'));
  });

  test('instructions with no operands (RET, NOP) render without an operand table lookup', () => {
    const entry = lookupOpcodeEntry('RET')!;
    const match = matchEncoding(entry, splitTopLevelOperands(''), noSymbols);
    assert.ok(match);
    assert.strictEqual(match!.encoding.opcode, '22H');
  });

  test('every mnemonic in the opcode table has prose in all three locales', () => {
    for (const catalog of [en, zhTw, zhCn]) {
      for (const mnemonic of [
        'ADD',
        'ADDC',
        'SUBB',
        'INC',
        'DEC',
        'MUL',
        'DIV',
        'DA',
        'ANL',
        'ORL',
        'XRL',
        'CLR',
        'CPL',
        'SETB',
        'RL',
        'RLC',
        'RR',
        'RRC',
        'SWAP',
        'MOV',
        'MOVC',
        'MOVX',
        'PUSH',
        'POP',
        'XCH',
        'XCHD',
        'ACALL',
        'LCALL',
        'RET',
        'RETI',
        'AJMP',
        'LJMP',
        'SJMP',
        'JMP',
        'JZ',
        'JNZ',
        'JC',
        'JNC',
        'JB',
        'JNB',
        'JBC',
        'CJNE',
        'DJNZ',
        'NOP',
      ]) {
        const prose = catalog.instructions[mnemonic];
        assert.ok(prose, `${catalog.code} is missing prose for ${mnemonic}`);
        assert.ok(
          prose.description.length > 0,
          `${catalog.code}/${mnemonic} has an empty description`,
        );
        assert.ok(
          prose.flags.length > 0,
          `${catalog.code}/${mnemonic} has empty flags text`,
        );
      }
    }
  });
});
