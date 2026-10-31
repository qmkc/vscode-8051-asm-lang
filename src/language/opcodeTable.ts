/**
 * Complete MCS-51 (8051) opcode reference, grouped by mnemonic. Purely
 * factual/language-neutral data (opcode/bytes/cycles per addressing mode) -
 * the human-readable prose (description/flags text/explanations) lives in
 * src/language/locales/*.ts so the two can be translated independently.
 *
 * Opcodes/bytes/cycles are for the classic 12-clock-per-machine-cycle 8051
 * core (the universal reference figures reproduced in every MCS-51
 * datasheet). Register-coded forms (Rn, @Ri) are shown as the opcode range
 * rather than resolved to a single byte, since which exact Rn/Ri is used
 * only changes the low bits.
 */

export type OperandType =
  | 'A'
  | 'B'
  | 'C'
  | 'AB'
  | 'DPTR'
  | '@DPTR'
  | '@A+DPTR'
  | '@A+PC'
  | 'Rn'
  | '@Ri'
  | 'direct'
  | 'bit'
  | 'notbit'
  | 'data'
  | 'data16'
  | 'rel';

export interface Encoding {
  operands: OperandType[];
  opcode: string;
  bytes: number;
  cycles: number;
}

export interface OpcodeEntry {
  mnemonic: string;
  encodings: Encoding[];
}

function enc(
  operands: OperandType[],
  opcode: string,
  bytes: number,
  cycles: number,
): Encoding {
  return { operands, opcode, bytes, cycles };
}

export const OPCODE_TABLE: OpcodeEntry[] = [
  // ---- Arithmetic ----
  {
    mnemonic: 'ADD',
    encodings: [
      enc(['A', 'Rn'], '28H-2FH', 1, 1),
      enc(['A', 'direct'], '25H', 2, 1),
      enc(['A', '@Ri'], '26H-27H', 1, 1),
      enc(['A', 'data'], '24H', 2, 1),
    ],
  },
  {
    mnemonic: 'ADDC',
    encodings: [
      enc(['A', 'Rn'], '38H-3FH', 1, 1),
      enc(['A', 'direct'], '35H', 2, 1),
      enc(['A', '@Ri'], '36H-37H', 1, 1),
      enc(['A', 'data'], '34H', 2, 1),
    ],
  },
  {
    mnemonic: 'SUBB',
    encodings: [
      enc(['A', 'Rn'], '98H-9FH', 1, 1),
      enc(['A', 'direct'], '95H', 2, 1),
      enc(['A', '@Ri'], '96H-97H', 1, 1),
      enc(['A', 'data'], '94H', 2, 1),
    ],
  },
  {
    mnemonic: 'INC',
    encodings: [
      enc(['A'], '04H', 1, 1),
      enc(['Rn'], '08H-0FH', 1, 1),
      enc(['direct'], '05H', 2, 1),
      enc(['@Ri'], '06H-07H', 1, 1),
      enc(['DPTR'], 'A3H', 1, 2),
    ],
  },
  {
    mnemonic: 'DEC',
    encodings: [
      enc(['A'], '14H', 1, 1),
      enc(['Rn'], '18H-1FH', 1, 1),
      enc(['direct'], '15H', 2, 1),
      enc(['@Ri'], '16H-17H', 1, 1),
    ],
  },
  { mnemonic: 'MUL', encodings: [enc(['AB'], 'A4H', 1, 4)] },
  { mnemonic: 'DIV', encodings: [enc(['AB'], '84H', 1, 4)] },
  { mnemonic: 'DA', encodings: [enc(['A'], 'D4H', 1, 1)] },

  // ---- Logic ----
  {
    mnemonic: 'ANL',
    encodings: [
      enc(['A', 'Rn'], '58H-5FH', 1, 1),
      enc(['A', 'direct'], '55H', 2, 1),
      enc(['A', '@Ri'], '56H-57H', 1, 1),
      enc(['A', 'data'], '54H', 2, 1),
      enc(['direct', 'A'], '52H', 2, 1),
      enc(['direct', 'data'], '53H', 3, 2),
      enc(['C', 'bit'], '82H', 2, 2),
      enc(['C', 'notbit'], 'B0H', 2, 2),
    ],
  },
  {
    mnemonic: 'ORL',
    encodings: [
      enc(['A', 'Rn'], '48H-4FH', 1, 1),
      enc(['A', 'direct'], '45H', 2, 1),
      enc(['A', '@Ri'], '46H-47H', 1, 1),
      enc(['A', 'data'], '44H', 2, 1),
      enc(['direct', 'A'], '42H', 2, 1),
      enc(['direct', 'data'], '43H', 3, 2),
      enc(['C', 'bit'], '72H', 2, 2),
      enc(['C', 'notbit'], 'A0H', 2, 2),
    ],
  },
  {
    mnemonic: 'XRL',
    encodings: [
      enc(['A', 'Rn'], '68H-6FH', 1, 1),
      enc(['A', 'direct'], '65H', 2, 1),
      enc(['A', '@Ri'], '66H-67H', 1, 1),
      enc(['A', 'data'], '64H', 2, 1),
      enc(['direct', 'A'], '62H', 2, 1),
      enc(['direct', 'data'], '63H', 3, 2),
    ],
  },
  {
    mnemonic: 'CLR',
    encodings: [
      enc(['A'], 'E4H', 1, 1),
      enc(['C'], 'C3H', 1, 1),
      enc(['bit'], 'C2H', 2, 1),
    ],
  },
  {
    mnemonic: 'CPL',
    encodings: [
      enc(['A'], 'F4H', 1, 1),
      enc(['C'], 'B3H', 1, 1),
      enc(['bit'], 'B2H', 2, 1),
    ],
  },
  {
    mnemonic: 'SETB',
    encodings: [enc(['C'], 'D3H', 1, 1), enc(['bit'], 'D2H', 2, 1)],
  },
  { mnemonic: 'RL', encodings: [enc(['A'], '23H', 1, 1)] },
  { mnemonic: 'RLC', encodings: [enc(['A'], '33H', 1, 1)] },
  { mnemonic: 'RR', encodings: [enc(['A'], '03H', 1, 1)] },
  { mnemonic: 'RRC', encodings: [enc(['A'], '13H', 1, 1)] },
  { mnemonic: 'SWAP', encodings: [enc(['A'], 'C4H', 1, 1)] },

  // ---- Data transfer ----
  {
    mnemonic: 'MOV',
    encodings: [
      enc(['A', 'Rn'], 'E8H-EFH', 1, 1),
      enc(['A', 'direct'], 'E5H', 2, 1),
      enc(['A', '@Ri'], 'E6H-E7H', 1, 1),
      enc(['A', 'data'], '74H', 2, 1),
      enc(['Rn', 'A'], 'F8H-FFH', 1, 1),
      enc(['Rn', 'direct'], 'A8H-AFH', 2, 2),
      enc(['Rn', 'data'], '78H-7FH', 2, 1),
      enc(['direct', 'A'], 'F5H', 2, 1),
      enc(['direct', 'Rn'], '88H-8FH', 2, 2),
      enc(['direct', 'direct'], '85H', 3, 2),
      enc(['direct', '@Ri'], '86H-87H', 2, 2),
      enc(['direct', 'data'], '75H', 3, 2),
      enc(['@Ri', 'A'], 'F6H-F7H', 1, 1),
      enc(['@Ri', 'direct'], 'A6H-A7H', 2, 2),
      enc(['@Ri', 'data'], '76H-77H', 2, 1),
      enc(['DPTR', 'data16'], '90H', 3, 2),
      enc(['C', 'bit'], 'A2H', 2, 1),
      enc(['bit', 'C'], '92H', 2, 2),
    ],
  },
  {
    mnemonic: 'MOVC',
    encodings: [
      enc(['A', '@A+DPTR'], '93H', 1, 2),
      enc(['A', '@A+PC'], '83H', 1, 2),
    ],
  },
  {
    mnemonic: 'MOVX',
    encodings: [
      enc(['A', '@Ri'], 'E2H-E3H', 1, 2),
      enc(['A', '@DPTR'], 'E0H', 1, 2),
      enc(['@Ri', 'A'], 'F2H-F3H', 1, 2),
      enc(['@DPTR', 'A'], 'F0H', 1, 2),
    ],
  },
  { mnemonic: 'PUSH', encodings: [enc(['direct'], 'C0H', 2, 2)] },
  { mnemonic: 'POP', encodings: [enc(['direct'], 'D0H', 2, 2)] },
  {
    mnemonic: 'XCH',
    encodings: [
      enc(['A', 'Rn'], 'C8H-CFH', 1, 1),
      enc(['A', 'direct'], 'C5H', 2, 1),
      enc(['A', '@Ri'], 'C6H-C7H', 1, 1),
    ],
  },
  { mnemonic: 'XCHD', encodings: [enc(['A', '@Ri'], 'D6H-D7H', 1, 1)] },

  // ---- Branching ----
  {
    mnemonic: 'ACALL',
    encodings: [enc(['rel'], '11H/31H/51H/71H/91H/B1H/D1H/F1H', 2, 2)],
  },
  { mnemonic: 'LCALL', encodings: [enc(['rel'], '12H', 3, 2)] },
  { mnemonic: 'RET', encodings: [enc([], '22H', 1, 2)] },
  { mnemonic: 'RETI', encodings: [enc([], '32H', 1, 2)] },
  {
    mnemonic: 'AJMP',
    encodings: [enc(['rel'], '01H/21H/41H/61H/81H/A1H/C1H/E1H', 2, 2)],
  },
  { mnemonic: 'LJMP', encodings: [enc(['rel'], '02H', 3, 2)] },
  { mnemonic: 'SJMP', encodings: [enc(['rel'], '80H', 2, 2)] },
  { mnemonic: 'JMP', encodings: [enc(['@A+DPTR'], '73H', 1, 2)] },
  { mnemonic: 'JZ', encodings: [enc(['rel'], '60H', 2, 2)] },
  { mnemonic: 'JNZ', encodings: [enc(['rel'], '70H', 2, 2)] },
  { mnemonic: 'JC', encodings: [enc(['rel'], '40H', 2, 2)] },
  { mnemonic: 'JNC', encodings: [enc(['rel'], '50H', 2, 2)] },
  { mnemonic: 'JB', encodings: [enc(['bit', 'rel'], '20H', 3, 2)] },
  { mnemonic: 'JNB', encodings: [enc(['bit', 'rel'], '30H', 3, 2)] },
  { mnemonic: 'JBC', encodings: [enc(['bit', 'rel'], '10H', 3, 2)] },
  {
    mnemonic: 'CJNE',
    encodings: [
      enc(['A', 'direct', 'rel'], 'B5H', 3, 2),
      enc(['A', 'data', 'rel'], 'B4H', 3, 2),
      enc(['Rn', 'data', 'rel'], 'B8H-BFH', 3, 2),
      enc(['@Ri', 'data', 'rel'], 'B6H-B7H', 3, 2),
    ],
  },
  {
    mnemonic: 'DJNZ',
    encodings: [
      enc(['Rn', 'rel'], 'D8H-DFH', 2, 2),
      enc(['direct', 'rel'], 'D5H', 3, 2),
    ],
  },

  // ---- Misc ----
  { mnemonic: 'NOP', encodings: [enc([], '00H', 1, 1)] },
];

const OPCODE_INDEX = new Map(OPCODE_TABLE.map((i) => [i.mnemonic, i]));

export function lookupOpcodeEntry(mnemonic: string): OpcodeEntry | undefined {
  return OPCODE_INDEX.get(mnemonic.toUpperCase());
}
