export interface InstructionSpec {
  mnemonic: string;
  operands: number[];
  summary: string;
}

// Canonical 8051 (MCS-51) instruction set as accepted by the Keil A51 assembler.
export const INSTRUCTIONS: InstructionSpec[] = [
  {
    mnemonic: 'ACALL',
    operands: [1],
    summary: 'Absolute call to subroutine (11-bit address).',
  },
  { mnemonic: 'ADD', operands: [2], summary: 'Add operand to accumulator.' },
  {
    mnemonic: 'ADDC',
    operands: [2],
    summary: 'Add operand and carry to accumulator.',
  },
  {
    mnemonic: 'AJMP',
    operands: [1],
    summary: 'Absolute jump (11-bit address).',
  },
  { mnemonic: 'ANL', operands: [2], summary: 'Logical AND.' },
  {
    mnemonic: 'CJNE',
    operands: [3],
    summary: 'Compare and jump if not equal.',
  },
  { mnemonic: 'CLR', operands: [1], summary: 'Clear bit/accumulator/carry.' },
  {
    mnemonic: 'CPL',
    operands: [1],
    summary: 'Complement bit/accumulator/carry.',
  },
  {
    mnemonic: 'DA',
    operands: [1],
    summary: 'Decimal adjust accumulator (BCD).',
  },
  { mnemonic: 'DEC', operands: [1], summary: 'Decrement operand.' },
  { mnemonic: 'DIV', operands: [1], summary: 'Divide A by B.' },
  {
    mnemonic: 'DJNZ',
    operands: [2],
    summary: 'Decrement and jump if not zero.',
  },
  { mnemonic: 'INC', operands: [1], summary: 'Increment operand.' },
  { mnemonic: 'JB', operands: [2], summary: 'Jump if bit is set.' },
  {
    mnemonic: 'JBC',
    operands: [2],
    summary: 'Jump if bit set, then clear bit.',
  },
  { mnemonic: 'JC', operands: [1], summary: 'Jump if carry is set.' },
  { mnemonic: 'JMP', operands: [1], summary: 'Indirect jump (@A+DPTR).' },
  { mnemonic: 'JNB', operands: [2], summary: 'Jump if bit is not set.' },
  { mnemonic: 'JNC', operands: [1], summary: 'Jump if carry is not set.' },
  {
    mnemonic: 'JNZ',
    operands: [1],
    summary: 'Jump if accumulator is not zero.',
  },
  { mnemonic: 'JZ', operands: [1], summary: 'Jump if accumulator is zero.' },
  {
    mnemonic: 'LCALL',
    operands: [1],
    summary: 'Long call to subroutine (16-bit address).',
  },
  { mnemonic: 'LJMP', operands: [1], summary: 'Long jump (16-bit address).' },
  { mnemonic: 'MOV', operands: [2], summary: 'Move data.' },
  { mnemonic: 'MOVC', operands: [2], summary: 'Move code byte.' },
  { mnemonic: 'MOVX', operands: [2], summary: 'Move external data byte.' },
  { mnemonic: 'MUL', operands: [1], summary: 'Multiply A by B.' },
  { mnemonic: 'NOP', operands: [0], summary: 'No operation.' },
  { mnemonic: 'ORL', operands: [2], summary: 'Logical OR.' },
  { mnemonic: 'POP', operands: [1], summary: 'Pop value from stack.' },
  { mnemonic: 'PUSH', operands: [1], summary: 'Push value onto stack.' },
  { mnemonic: 'RET', operands: [0], summary: 'Return from subroutine.' },
  { mnemonic: 'RETI', operands: [0], summary: 'Return from interrupt.' },
  { mnemonic: 'RL', operands: [1], summary: 'Rotate accumulator left.' },
  {
    mnemonic: 'RLC',
    operands: [1],
    summary: 'Rotate accumulator left through carry.',
  },
  { mnemonic: 'RR', operands: [1], summary: 'Rotate accumulator right.' },
  {
    mnemonic: 'RRC',
    operands: [1],
    summary: 'Rotate accumulator right through carry.',
  },
  { mnemonic: 'SETB', operands: [1], summary: 'Set bit.' },
  { mnemonic: 'SJMP', operands: [1], summary: 'Short jump (relative).' },
  { mnemonic: 'SUBB', operands: [2], summary: 'Subtract with borrow.' },
  { mnemonic: 'SWAP', operands: [1], summary: 'Swap nibbles of accumulator.' },
  { mnemonic: 'XCH', operands: [2], summary: 'Exchange byte.' },
  { mnemonic: 'XCHD', operands: [2], summary: 'Exchange digit (low nibble).' },
  { mnemonic: 'XRL', operands: [2], summary: 'Logical XOR.' },
];

export const DIRECTIVES = [
  'ORG',
  'END',
  'EQU',
  'SET',
  'DATA',
  'IDATA',
  'XDATA',
  'BIT',
  'CODE',
  'DBIT',
  'DB',
  'DW',
  'DS',
  'SEGMENT',
  'RSEG',
  'CSEG',
  'DSEG',
  'BSEG',
  'ISEG',
  'XSEG',
  'PUBLIC',
  'EXTRN',
  'EXTERN',
  'NAME',
  'USING',
  'PAGE',
  'LOCAL',
  'MACRO',
  'ENDM',
  'EXITM',
  'IF',
  'ELSE',
  'ENDIF',
  'REPT',
  'WHILE',
  'ENDW',
];

export const REGISTERS = [
  'A',
  'B',
  'AB',
  'C',
  'R0',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'DPTR',
  'DPL',
  'DPH',
  'PC',
  'SP',
  'PSW',
];

const INSTRUCTION_MAP = new Map(INSTRUCTIONS.map((i) => [i.mnemonic, i]));

export function lookupInstruction(
  mnemonic: string,
): InstructionSpec | undefined {
  return INSTRUCTION_MAP.get(mnemonic.toUpperCase());
}

export function isDirective(word: string): boolean {
  return DIRECTIVES.includes(word.toUpperCase());
}

export function isKnownMnemonic(word: string): boolean {
  return INSTRUCTION_MAP.has(word.toUpperCase()) || isDirective(word);
}
