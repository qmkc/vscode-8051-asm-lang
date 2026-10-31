import { SymbolKind } from './symbolIndex';
import { Encoding, OpcodeEntry, OperandType } from './opcodeTable';
import { LocaleCatalog } from './locales/types';

/** Splits operand text on top-level commas (ignoring commas inside quotes/parens). */
export function splitTopLevelOperands(text: string): string[] {
  const operands: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '(') {
      depth++;
    } else if (!inString && ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (!inString && depth === 0 && ch === ',') {
      operands.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last.length > 0 || operands.length > 0) {
    operands.push(last);
  }
  return operands.filter((o) => o.length > 0);
}

/** Whether `text`, as actually written, could plausibly be the given operand type. `symbolKind` disambiguates a bare identifier when its definition kind (e.g. 'bit' vs 'equ') is known. */
export function satisfies(
  text: string,
  type: OperandType,
  symbolKind: SymbolKind | undefined,
): boolean {
  const t = text.trim();
  const isReserved = /^(R[0-7]|A|B|C|AB|DPTR)$/i.test(t);

  switch (type) {
    case 'A':
      return /^A$/i.test(t);
    case 'B':
      return /^B$/i.test(t);
    case 'C':
      return /^C$/i.test(t);
    case 'AB':
      return /^AB$/i.test(t);
    case 'DPTR':
      return /^DPTR$/i.test(t);
    case '@DPTR':
      return /^@DPTR$/i.test(t);
    case '@A+DPTR':
      return /^@A\+DPTR$/i.test(t);
    case '@A+PC':
      return /^@A\+PC$/i.test(t);
    case 'Rn':
      return /^R[0-7]$/i.test(t);
    case '@Ri':
      return /^@R[01]$/i.test(t);
    case 'data':
    case 'data16':
      return t.startsWith('#');
    case 'notbit':
      return t.startsWith('/');
    case 'bit':
      if (
        t.startsWith('#') ||
        t.startsWith('@') ||
        t.startsWith('/') ||
        isReserved
      ) {
        return false;
      }
      return (
        symbolKind === 'bit' || /\.[0-7]$/.test(t) || symbolKind === undefined
      );
    case 'direct':
      return (
        !t.startsWith('#') &&
        !t.startsWith('@') &&
        !t.startsWith('/') &&
        !isReserved
      );
    case 'rel':
      return (
        !t.startsWith('#') &&
        !t.startsWith('@') &&
        !t.startsWith('/') &&
        !isReserved
      );
    default:
      return false;
  }
}

export interface EncodingMatch {
  encoding: Encoding;
  operandTexts: string[];
}

/** Finds the first encoding whose declared operand types the actual operand texts satisfy. */
export function matchEncoding(
  entry: OpcodeEntry,
  operandTexts: string[],
  symbolKindOf: (name: string) => SymbolKind | undefined,
): EncodingMatch | undefined {
  for (const encoding of entry.encodings) {
    if (encoding.operands.length !== operandTexts.length) {
      continue;
    }
    const allSatisfy = encoding.operands.every((type, i) => {
      const text = operandTexts[i];
      const kind = /^[A-Za-z_?][A-Za-z0-9_?]*$/.test(text)
        ? symbolKindOf(text)
        : undefined;
      return satisfies(text, type, kind);
    });
    if (allSatisfy) {
      return { encoding, operandTexts };
    }
  }
  return undefined;
}

/** Well-established 8051 facts worth surfacing for the addressing mode actually used (locale-independent selection; the catalog supplies the text). */
function selectNoteKeys(mnemonic: string, encoding: Encoding): string[] {
  const keys: string[] = [];
  const types = encoding.operands;

  if (types.includes('@Ri')) {
    keys.push('atRi');
  }
  if (types.includes('bit') || types.includes('notbit')) {
    keys.push('bitRange');
  }
  if (mnemonic === 'ACALL' || mnemonic === 'AJMP') {
    keys.push('acallAjmpPage');
  }
  if (
    types.includes('rel') &&
    mnemonic !== 'ACALL' &&
    mnemonic !== 'AJMP' &&
    mnemonic !== 'LCALL' &&
    mnemonic !== 'LJMP'
  ) {
    keys.push('relRange');
  }
  if (mnemonic === 'RETI') {
    keys.push('reti');
  }
  if (mnemonic === 'DA') {
    keys.push('da');
  }
  if (mnemonic === 'MUL') {
    keys.push('mul');
  }
  if (mnemonic === 'DIV') {
    keys.push('div');
  }

  return keys;
}

/** Renders the full hover body as Markdown in the given locale, for the already-resolved instruction/encoding data. */
export function renderHoverMarkdown(
  catalog: LocaleCatalog,
  mnemonicUpper: string,
  operandText: string,
  entry: OpcodeEntry,
  match: EncodingMatch | undefined,
  label: string | undefined,
): string {
  const prose = catalog.instructions[mnemonicUpper];
  if (!prose) {
    return '';
  }

  const lines: string[] = [];
  const mnemonicAndOperands = `${mnemonicUpper}${operandText ? ' ' + operandText : ''}`;
  lines.push(
    `### ${catalog.ui.heading(mnemonicAndOperands, label)}`,
    '',
    prose.description,
    '',
  );

  if (match) {
    const phrases = match.encoding.operands.map((type, i) =>
      catalog.describeOperand(match.operandTexts[i], type),
    );
    lines.push(prose.explain(phrases), '');
    lines.push(catalog.ui.opcodeTableHeader);
    lines.push(
      `| ${match.encoding.opcode} | ${catalog.ui.byteUnit(match.encoding.bytes)} | ${match.encoding.cycles} | ${prose.flags} |`,
      '',
    );
    for (const key of selectNoteKeys(mnemonicUpper, match.encoding)) {
      const note = catalog.notes[key];
      if (note) {
        lines.push(`> ${note}`, '');
      }
    }
  } else if (operandText.length > 0) {
    lines.push(catalog.ui.noMatchIntro(mnemonicUpper, operandText), '');
    lines.push(catalog.ui.operandTableHeader);
    for (const e of entry.encodings) {
      lines.push(
        `| ${e.operands.join(', ') || catalog.ui.noneOperand} | ${e.opcode} | ${e.bytes} | ${e.cycles} |`,
      );
    }
    lines.push('', catalog.ui.flagsLabel(prose.flags));
  } else {
    lines.push(catalog.ui.opcodeTableHeader);
    for (const e of entry.encodings) {
      lines.push(
        `| ${e.opcode} | ${catalog.ui.byteUnit(e.bytes)} | ${e.cycles} | ${prose.flags} |`,
      );
    }
  }

  return lines.join('\n');
}
