import { OperandType } from '../opcodeTable';
import { LocaleCatalog } from './types';

function describeOperand(text: string, type: OperandType): string {
  switch (type) {
    case 'A':
      return 'accumulator A';
    case 'B':
      return 'register B';
    case 'C':
      return 'the carry flag C';
    case 'AB':
      return 'the A/B register pair';
    case 'DPTR':
      return 'DPTR';
    case '@DPTR':
      return 'external data memory pointed to by DPTR';
    case '@A+DPTR':
      return 'program memory at A + DPTR';
    case '@A+PC':
      return 'program memory at A + PC';
    case 'Rn':
      return `working register ${text.toUpperCase()}`;
    case '@Ri':
      return `internal RAM pointed to by ${text.toUpperCase()} (indirect addressing)`;
    case 'bit':
      return `bit ${text}`;
    case 'notbit':
      return `the complement of bit ${text.slice(1)}`;
    case 'data':
      return `immediate value ${text}`;
    case 'data16':
      return `16-bit immediate value ${text}`;
    case 'direct':
    case 'rel':
    default:
      return text;
  }
}

export const en: LocaleCatalog = {
  code: 'en',
  describeOperand,
  notes: {
    atRi: 'R0/R1 indirect addressing covers 00H-7FH of plain internal RAM. On parts with 256 bytes of RAM (e.g. 8052), 80H-FFH is the upper half of RAM, not the SFRs (SFRs are only reachable via direct addressing).',
    bitRange:
      'Bit-addressable space is limited to 20H-2FH (the bit-addressable RAM segment) plus the bit-addressable SFRs (those at addresses that are multiples of 8, e.g. PSW, IE, P0-P3).',
    acallAjmpPage:
      'ACALL/AJMP can only reach a target in the same 2KB page as the next instruction; use LCALL/LJMP to cross a page boundary.',
    relRange:
      'A relative jump’s displacement range is -128..+127, measured from the address of the next instruction; out-of-range targets are an assembly-time error.',
    reti: 'RETI differs from RET: it also restores the interrupt-priority logic so that another interrupt at the same priority level can be serviced again. Use plain RET for ordinary subroutines.',
    da: 'DA A only makes sense right after ADD/ADDC on BCD operands - never after SUBB.',
    mul: 'OV is set when the product exceeds 255 (i.e. the high byte B is non-zero).',
    div: 'OV is set when the divisor (B) is zero, in which case the results in A and B are meaningless.',
  },
  ui: {
    heading: (mo, label) => (label ? `${mo} — inside ${label}` : mo),
    opcodeTableHeader:
      '| Opcode | Length | Cycles | Flags |\n|---|---|---|---|',
    operandTableHeader:
      '| Operands | Opcode | Length | Cycles |\n|---|---|---|---|',
    flagsLabel: (flags) => `Flags: ${flags}`,
    noMatchIntro: (mnemonic, operandText) =>
      `_No addressing mode matches \`${operandText}\`. Here are all the forms ${mnemonic} supports:_`,
    noneOperand: '(none)',
    byteUnit: (bytes) => `${bytes} byte${bytes > 1 ? 's' : ''}`,
    callPseudoInstruction:
      'CALL: an A51 pseudo-instruction. The assembler picks `ACALL` (same page) or `LCALL` (anywhere) automatically based on the distance to the target, so it has no fixed opcode/length/cycle count.',
  },
  instructions: {
    ADD: {
      description:
        'ADD: adds the operand to the accumulator A, storing the result back in A.',
      flags: 'Cy, OV, AC',
      explain: (o) =>
        `Add ${o[1]} to accumulator A, storing the result back in A.`,
    },
    ADDC: {
      description:
        'ADDC: adds the operand and the current carry flag C to accumulator A - typically used for the high byte of a multi-byte addition.',
      flags: 'Cy, OV, AC',
      explain: (o) =>
        `Add ${o[1]} and the carry flag C to accumulator A (A ← A + ${o[1]} + Cy).`,
    },
    SUBB: {
      description:
        'SUBB: subtracts the operand and the current carry flag C from accumulator A - typically used for multi-byte subtraction.',
      flags: 'Cy, OV, AC',
      explain: () => `A ← A - operand - Cy (subtract with borrow).`,
    },
    INC: {
      description:
        'INC: increments the operand by one. Affects no flags (not even on INC A).',
      flags: 'None (INC DPTR also leaves flags unaffected)',
      explain: (o) => `Increment ${o[0]} by one.`,
    },
    DEC: {
      description: 'DEC: decrements the operand by one. Affects no flags.',
      flags: 'None',
      explain: (o) => `Decrement ${o[0]} by one.`,
    },
    MUL: {
      description:
        'MUL AB: multiplies A by B. The 16-bit result’s high byte is stored back in B, the low byte in A.',
      flags: 'Cy=0, OV (set when the product exceeds 255)',
      explain: () =>
        'A × B, 16-bit result: the high byte goes back into B, the low byte into A. Cy is always cleared; OV is set if the product exceeds 255.',
    },
    DIV: {
      description:
        'DIV AB: divides A by B. The quotient is stored back in A, the remainder in B.',
      flags: 'Cy=0, OV (set on divide-by-zero)',
      explain: () =>
        'A ÷ B: the quotient goes back into A, the remainder into B. Cy is always cleared; OV is set (and the results are meaningless) if B is zero.',
    },
    DA: {
      description:
        'DA A: adjusts the binary addition result in A into correct packed BCD. Must be used immediately after ADD/ADDC.',
      flags: 'Cy (may be set, never cleared)',
      explain: () =>
        'Adjusts A for BCD (adding 06H and/or 60H) based on AC/Cy and whether A’s low/high nibble exceeds 9.',
    },
    ANL: {
      description:
        'ANL: logical AND - either A with an operand, direct with A/an immediate, or the carry flag C with a bit.',
      flags: 'The C,bit form changes Cy; the other forms affect no flags',
      explain: (o) =>
        o[0] === 'C' || o[0].startsWith('the carry flag')
          ? `AND ${o[1]} into the carry flag C.`
          : `${o[0]} ← ${o[0]} AND ${o[1]}.`,
    },
    ORL: {
      description:
        'ORL: logical OR - either A with an operand, direct with A/an immediate, or the carry flag C with a bit.',
      flags: 'The C,bit form changes Cy; the other forms affect no flags',
      explain: (o) =>
        o[0] === 'C' || o[0].startsWith('the carry flag')
          ? `OR ${o[1]} into the carry flag C.`
          : `${o[0]} ← ${o[0]} OR ${o[1]}.`,
    },
    XRL: {
      description:
        'XRL: logical XOR between A/Rn, A/direct, A/@Ri, A/immediate, direct/A, or direct/immediate.',
      flags: 'None',
      explain: (o) => `${o[0]} ← ${o[0]} XOR ${o[1]}.`,
    },
    CLR: {
      description:
        'CLR: clears accumulator A, the carry flag C, or an addressable bit to 0.',
      flags: 'CLR C clears Cy; CLR bit leaves the PSW flags unaffected',
      explain: (o) => `Clear ${o[0]} to 0.`,
    },
    CPL: {
      description:
        'CPL: complements accumulator A, the carry flag C, or an addressable bit, bit by bit.',
      flags: 'CPL C toggles Cy; CPL bit leaves the PSW flags unaffected',
      explain: (o) => `Complement ${o[0]}, bit by bit.`,
    },
    SETB: {
      description: 'SETB: sets the carry flag C or an addressable bit to 1.',
      flags: 'SETB C sets Cy; SETB bit leaves the PSW flags unaffected',
      explain: (o) => `Set ${o[0]} to 1.`,
    },
    RL: {
      description:
        'RL A: rotates accumulator A left by one bit (bit7 → bit0), without going through the carry flag.',
      flags: 'None',
      explain: () =>
        'Every bit of A shifts left by one; the old bit7 goes straight into bit0 (Cy is not involved).',
    },
    RLC: {
      description:
        'RLC A: rotates accumulator A together with the carry flag C left by one bit (A.bit7 → Cy → A.bit0).',
      flags: 'Cy',
      explain: () =>
        'A and Cy rotate left together: the old bit7 goes into Cy, and the old Cy goes into bit0.',
    },
    RR: {
      description:
        'RR A: rotates accumulator A right by one bit (bit0 → bit7), without going through the carry flag.',
      flags: 'None',
      explain: () =>
        'Every bit of A shifts right by one; the old bit0 goes straight into bit7 (Cy is not involved).',
    },
    RRC: {
      description:
        'RRC A: rotates accumulator A together with the carry flag C right by one bit (A.bit0 → Cy → A.bit7).',
      flags: 'Cy',
      explain: () =>
        'A and Cy rotate right together: the old bit0 goes into Cy, and the old Cy goes into bit7.',
    },
    SWAP: {
      description:
        'SWAP A: swaps the high and low nibbles (4 bits each) of accumulator A.',
      flags: 'None',
      explain: () => 'Swap A’s high nibble and low nibble.',
    },
    MOV: {
      description:
        'MOV: copies data between registers, memory addresses, and immediate values. Affects no flags, except MOV C,bit, which changes Cy.',
      flags: 'None (MOV C,bit changes Cy)',
      explain: (o) =>
        o[0] === 'C' || o[0].startsWith('the carry flag')
          ? `Copy the value of ${o[1]} into the carry flag C.`
          : `Copy the value of ${o[1]} into ${o[0]}.`,
    },
    MOVC: {
      description:
        'MOVC: reads one byte from program memory (the Code space) into accumulator A - the standard way to read a constant/lookup table.',
      flags: 'None',
      explain: (o) =>
        `Table lookup: read one byte from ${o[1]} into accumulator A.`,
    },
    MOVX: {
      description:
        'MOVX: reads/writes external data memory (XDATA), addressed either via @Ri (an 8-bit address, commonly paired with P2 as the high byte) or @DPTR (a 16-bit address).',
      flags: 'None',
      explain: (o) =>
        o[0] === 'A' || o[0] === 'accumulator A'
          ? `Read one byte from external data memory ${o[1]} into accumulator A.`
          : `Write the value of accumulator A to external data memory ${o[0]}.`,
    },
    PUSH: {
      description:
        'PUSH: increments the stack pointer SP first, then writes the operand’s value to the address SP now points to.',
      flags: 'None',
      explain: (o) =>
        `Increment SP first, then write the value of ${o[0]} onto the stack (the internal RAM SP now points to).`,
    },
    POP: {
      description:
        'POP: reads the value SP points to into the operand first, then decrements SP.',
      flags: 'None',
      explain: (o) =>
        `Read one byte off the stack into ${o[0]}, then decrement SP.`,
    },
    XCH: {
      description:
        'XCH: exchanges the contents of accumulator A and the operand.',
      flags: 'None',
      explain: (o) => `Exchange the contents of ${o[0]} and ${o[1]}.`,
    },
    XCHD: {
      description:
        'XCHD A,@Ri: exchanges only the low nibble of A with the low nibble of the byte @Ri points to (the high nibbles are untouched).',
      flags: 'None',
      explain: (o) =>
        `Exchange only the low nibble of A with the low nibble of ${o[1]}; the high nibbles are untouched.`,
    },
    ACALL: {
      description:
        'ACALL addr11: an absolute call that can only reach the same 2KB page as the next instruction; the return address (PC) is pushed onto the stack.',
      flags: 'None',
      explain: (o) =>
        `Push the current PC (the next instruction’s address) onto the stack, then call ${o[0]} within the same 2KB page.`,
    },
    LCALL: {
      description:
        'LCALL addr16: a long call that can reach any address in the 64KB program space; the return address (PC) is pushed onto the stack.',
      flags: 'None',
      explain: (o) =>
        `Push the current PC (the next instruction’s address) onto the stack, then call ${o[0]}.`,
    },
    RET: {
      description:
        'RET: returns from a subroutine, popping two bytes off the top of the stack back into PC.',
      flags: 'None',
      explain: () =>
        'Pop the return address (2 bytes) off the stack back into PC, resuming execution after the call site.',
    },
    RETI: {
      description:
        'RETI: returns from an interrupt service routine (ISR). Besides popping the return address, it also restores the interrupt-priority logic so a same-priority interrupt can be serviced again.',
      flags: 'None',
      explain: () =>
        'Pop the return address off the stack back into PC, and clear the "interrupt in progress" state so a same-priority interrupt can fire again.',
    },
    AJMP: {
      description:
        'AJMP addr11: an absolute jump that can only reach the same 2KB page as the next instruction.',
      flags: 'None',
      explain: (o) => `Jump to ${o[0]} within the same 2KB page.`,
    },
    LJMP: {
      description:
        'LJMP addr16: a long jump that can reach any address in the 64KB program space.',
      flags: 'None',
      explain: (o) => `Jump to ${o[0]}.`,
    },
    SJMP: {
      description:
        'SJMP rel: a relative jump with a displacement range of -128..+127, measured from the next instruction.',
      flags: 'None',
      explain: (o) =>
        `Jump relative to ${o[0]} (the displacement must fall within -128..+127).`,
    },
    JMP: {
      description:
        'JMP @A+DPTR: an indirect jump using A as the offset and DPTR as the base - the standard way to implement a jump table.',
      flags: 'None',
      explain: () =>
        'Jump to the address at A + DPTR (common in switch/jump-table implementations).',
    },
    JZ: {
      description: 'JZ rel: a relative jump taken if accumulator A is zero.',
      flags: 'None',
      explain: (o) => `If A equals 0, jump to ${o[0]}.`,
    },
    JNZ: {
      description:
        'JNZ rel: a relative jump taken if accumulator A is not zero.',
      flags: 'None',
      explain: (o) => `If A is not equal to 0, jump to ${o[0]}.`,
    },
    JC: {
      description: 'JC rel: a relative jump taken if the carry flag C is 1.',
      flags: 'None',
      explain: (o) => `If Cy = 1, jump to ${o[0]}.`,
    },
    JNC: {
      description: 'JNC rel: a relative jump taken if the carry flag C is 0.',
      flags: 'None',
      explain: (o) => `If Cy = 0, jump to ${o[0]}.`,
    },
    JB: {
      description:
        'JB bit,rel: a relative jump taken if the given addressable bit is 1.',
      flags: 'None',
      explain: (o) => `If ${o[0]} = 1, jump to ${o[1]}.`,
    },
    JNB: {
      description:
        'JNB bit,rel: a relative jump taken if the given addressable bit is 0.',
      flags: 'None',
      explain: (o) => `If ${o[0]} = 0, jump to ${o[1]}.`,
    },
    JBC: {
      description:
        'JBC bit,rel: jumps if the given addressable bit is 1, and clears that bit before jumping.',
      flags: 'None',
      explain: (o) => `If ${o[0]} = 1, clear that bit, then jump to ${o[1]}.`,
    },
    CJNE: {
      description:
        'CJNE: compares two operands and jumps if they are unequal, also setting the carry flag C based on the comparison (Cy=1 if the first operand is less than the second).',
      flags: 'Cy',
      explain: (o) =>
        `Compare ${o[0]} and ${o[1]}; if unequal, jump to ${o[2]}. Cy is set if ${o[0]} < ${o[1]}.`,
    },
    DJNZ: {
      description:
        'DJNZ: decrements the operand first, then jumps relative if the result is non-zero - the standard loop-counter idiom.',
      flags: 'None',
      explain: (o) =>
        `Decrement ${o[0]} first; if the result is non-zero, jump to ${o[1]}.`,
    },
    NOP: {
      description:
        'NOP: does nothing except consume one machine cycle - useful for precise timing or alignment.',
      flags: 'None',
      explain: () => 'Perform no operation; just consumes 1 machine cycle.',
    },
  },
};
