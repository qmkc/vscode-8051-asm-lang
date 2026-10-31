import { OperandType } from '../opcodeTable';
import { LocaleCatalog } from './types';

function describeOperand(text: string, type: OperandType): string {
  switch (type) {
    case 'A':
      return '累加器 A';
    case 'B':
      return '寄存器 B';
    case 'C':
      return '进位标志 C';
    case 'AB':
      return 'A、B 寄存器对';
    case 'DPTR':
      return 'DPTR';
    case '@DPTR':
      return 'DPTR 指向的外部数据存储器';
    case '@A+DPTR':
      return 'A + DPTR 指向的程序存储器';
    case '@A+PC':
      return 'A + PC 指向的程序存储器';
    case 'Rn':
      return `工作寄存器 ${text.toUpperCase()}`;
    case '@Ri':
      return `${text.toUpperCase()} 指向的内部 RAM（间接寻址）`;
    case 'bit':
      return `位 ${text}`;
    case 'notbit':
      return `位 ${text.slice(1)} 的取反值`;
    case 'data':
      return `立即数 ${text}`;
    case 'data16':
      return `16 位立即数 ${text}`;
    case 'direct':
    case 'rel':
    default:
      return text;
  }
}

export const zhCn: LocaleCatalog = {
  code: 'zh-cn',
  describeOperand,
  notes: {
    atRi: 'R0/R1 间接寻址 00H–7FH 访问一般内部 RAM；指向 80H–FFH 时，在有 256 字节 RAM 的型号（如 8052）上访问的是上半部分 RAM，而非 SFR（SFR 只能用直接寻址访问）。',
    bitRange:
      '可位寻址的范围仅限 20H–2FH（位寻址区）以及地址为 8 的倍数的可位寻址 SFR（例如 PSW、IE、P0–P3）。',
    acallAjmpPage:
      'ACALL/AJMP 只能跳到与下一条指令同一个 2KB 页面内；跨页需改用 LCALL/LJMP。',
    relRange:
      '相对跳转的偏移范围为 −128~+127（以下一条指令地址为基准），超出范围汇编会报错。',
    reti: 'RETI 与 RET 的区别：RETI 会额外恢复中断优先级逻辑，让同优先级的中断能再次被响应；一般子程序请用 RET。',
    da: 'DA A 只在 ADD/ADDC 之后、且操作数为 BCD 码时才有意义，不能接在 SUBB 之后使用。',
    mul: '乘积超过 255（即高字节 B 非 0）时设定 OV。',
    div: '除数（B）为 0 时设定 OV，此时 A、B 的结果无意义。',
  },
  ui: {
    heading: (mo, label) => (label ? `${mo} — 位于 ${label}` : mo),
    opcodeTableHeader: '| 机器码 | 长度 | 周期 | 标志 |\n|---|---|---|---|',
    operandTableHeader: '| 操作数 | 机器码 | 长度 | 周期 |\n|---|---|---|---|',
    flagsLabel: (flags) => `标志：${flags}`,
    noMatchIntro: (mnemonic, operandText) =>
      `_找不到与 \`${operandText}\` 对应的寻址方式，以下是 ${mnemonic} 支持的所有形式：_`,
    noneOperand: '(无)',
    byteUnit: (bytes) => `${bytes} byte${bytes > 1 ? 's' : ''}`,
    callPseudoInstruction:
      'CALL：A51 的伪指令，汇编器会依目标地址与当前位置的距离，自动选择 `ACALL`（同页内）或 `LCALL`（任意地址），没有固定的机器码/长度/周期。',
  },
  instructions: {
    ADD: {
      description: 'ADD：把操作数加到累加器 A，结果存回 A。',
      flags: 'Cy, OV, AC',
      explain: (o) => `把 ${o[1]} 加到累加器 A，结果存回 A。`,
    },
    ADDC: {
      description:
        'ADDC：把操作数与当前的进位标志 C 一起加到累加器 A，常用于多字节加法的高字节。',
      flags: 'Cy, OV, AC',
      explain: (o) =>
        `把 ${o[1]} 与进位标志 C 一起加到累加器 A（A ← A + ${o[1]} + Cy）。`,
    },
    SUBB: {
      description:
        'SUBB：用累加器 A 减去操作数与当前的进位标志 C，常用于多字节减法。',
      flags: 'Cy, OV, AC',
      explain: () => `A ← A − 操作数 − Cy（带借位减法）。`,
    },
    INC: {
      description:
        'INC：操作数的值加一，不影响任何标志（INC A 也不影响 OV/Cy）。',
      flags: '无（INC DPTR 也不影响标志）',
      explain: (o) => `${o[0]} 的值加一。`,
    },
    DEC: {
      description: 'DEC：操作数的值减一，不影响任何标志。',
      flags: '无',
      explain: (o) => `${o[0]} 的值减一。`,
    },
    MUL: {
      description:
        'MUL AB：把 A 与 B 相乘，16 位结果的高字节存回 B、低字节存回 A。',
      flags: 'Cy=0, OV（乘积大于 255 时设定）',
      explain: () =>
        'A × B，16 位结果：高字节存回 B，低字节存回 A；Cy 固定清为 0，乘积超过 255 时设定 OV。',
    },
    DIV: {
      description: 'DIV AB：A 除以 B，商存回 A、余数存回 B。',
      flags: 'Cy=0, OV（除数为 0 时设定）',
      explain: () =>
        'A ÷ B：商存回 A，余数存回 B；Cy 固定清为 0，若 B 为 0 则设定 OV（结果无意义）。',
    },
    DA: {
      description:
        'DA A：将累加器 A 中的二进制加法结果调整为正确的压缩 BCD，必须紧接在 ADD/ADDC 之后使用。',
      flags: 'Cy（可能被设定，不会被清除）',
      explain: () =>
        '依 AC/Cy 与 A 的低 4 位/高 4 位是否超过 9，对 A 做 BCD 调整（加 06H 与/或 60H）。',
    },
    ANL: {
      description:
        'ANL：逻辑 AND，可以是 A 与操作数、direct 与 A/立即数，或进位标志 C 与某个位。',
      flags: 'ANL C,bit 形式会改变 Cy；其余形式不影响标志',
      explain: (o) =>
        o[0] === 'C' || o[0] === '进位标志 C'
          ? `把 ${o[1]} 的值 AND 进一步存回进位标志 C。`
          : `${o[0]} ← ${o[0]} AND ${o[1]}。`,
    },
    ORL: {
      description:
        'ORL：逻辑 OR，可以是 A 与操作数、direct 与 A/立即数，或进位标志 C 与某个位。',
      flags: 'ORL C,bit 形式会改变 Cy；其余形式不影响标志',
      explain: (o) =>
        o[0] === 'C' || o[0] === '进位标志 C'
          ? `把 ${o[1]} 的值 OR 进一步存回进位标志 C。`
          : `${o[0]} ← ${o[0]} OR ${o[1]}。`,
    },
    XRL: {
      description:
        'XRL：逻辑 XOR，操作数可以是 A/Rn、A/direct、A/@Ri、A/立即数、direct/A 或 direct/立即数。',
      flags: '无',
      explain: (o) => `${o[0]} ← ${o[0]} XOR ${o[1]}。`,
    },
    CLR: {
      description: 'CLR：把累加器 A、进位标志 C 或某个可寻址位清为 0。',
      flags: 'CLR C 会清除 Cy；CLR bit 不影响 PSW 标志',
      explain: (o) => `把 ${o[0]} 清为 0。`,
    },
    CPL: {
      description: 'CPL：把累加器 A、进位标志 C 或某个可寻址位逐位取反。',
      flags: 'CPL C 会改变 Cy；CPL bit 不影响 PSW 标志',
      explain: (o) => `把 ${o[0]} 逐位取反。`,
    },
    SETB: {
      description: 'SETB：把进位标志 C 或某个可寻址位设为 1。',
      flags: 'SETB C 会设定 Cy；SETB bit 不影响 PSW 标志',
      explain: (o) => `把 ${o[0]} 设为 1。`,
    },
    RL: {
      description:
        'RL A：把累加器 A 向左循环移一位（bit7 → bit0），不经过进位标志。',
      flags: '无',
      explain: () =>
        'A 的每一位向左移一位，原来的 bit7 直接进到 bit0（不经过 Cy）。',
    },
    RLC: {
      description:
        'RLC A：把累加器 A 连同进位标志 C 一起向左循环移一位（A.bit7 → Cy → A.bit0）。',
      flags: 'Cy',
      explain: () =>
        'A 与 Cy 一起向左循环移位：原来的 bit7 进到 Cy，原来的 Cy 进到 bit0。',
    },
    RR: {
      description:
        'RR A：把累加器 A 向右循环移一位（bit0 → bit7），不经过进位标志。',
      flags: '无',
      explain: () =>
        'A 的每一位向右移一位，原来的 bit0 直接进到 bit7（不经过 Cy）。',
    },
    RRC: {
      description:
        'RRC A：把累加器 A 连同进位标志 C 一起向右循环移一位（A.bit0 → Cy → A.bit7）。',
      flags: 'Cy',
      explain: () =>
        'A 与 Cy 一起向右循环移位：原来的 bit0 进到 Cy，原来的 Cy 进到 bit7。',
    },
    SWAP: {
      description: 'SWAP A：交换累加器 A 的高 4 位与低 4 位（半字节交换）。',
      flags: '无',
      explain: () => '把 A 的高 4 位与低 4 位互换。',
    },
    MOV: {
      description:
        'MOV：在寄存器、存储器地址、立即数之间复制数据，不影响标志（MOV C,bit 除外，会改变 Cy）。',
      flags: '无（MOV C,bit 会改变 Cy）',
      explain: (o) =>
        o[0] === 'C' || o[0] === '进位标志 C'
          ? `把 ${o[1]} 的值复制到进位标志 C。`
          : `把 ${o[1]} 的值复制到 ${o[0]}。`,
    },
    MOVC: {
      description:
        'MOVC：从程序存储器（Code 空间）查表读取一个字节到累加器 A，常用于常量表/查表。',
      flags: '无',
      explain: (o) => `查表：从 ${o[1]} 读出一个字节，存回累加器 A。`,
    },
    MOVX: {
      description:
        'MOVX：读写外部数据存储器（XDATA），寻址方式为 @Ri（8 位地址，常搭配 P2 作为高字节）或 @DPTR（16 位地址）。',
      flags: '无',
      explain: (o) =>
        o[0] === 'A' || o[0] === '累加器 A'
          ? `从外部数据存储器 ${o[1]} 读取一个字节到累加器 A。`
          : `把累加器 A 的值写入外部数据存储器 ${o[0]}。`,
    },
    PUSH: {
      description:
        'PUSH：先把堆栈指针 SP 加一，再把操作数的值写入 SP 所指向的地址。',
      flags: '无',
      explain: (o) =>
        `SP 先加一，再把 ${o[0]} 的值写入堆栈（SP 所指向的内部 RAM）。`,
    },
    POP: {
      description:
        'POP：先读出 SP 所指向的值写入操作数，再把堆栈指针 SP 减一。',
      flags: '无',
      explain: (o) => `从堆栈读出一个字节写入 ${o[0]}，再把 SP 减一。`,
    },
    XCH: {
      description: 'XCH：交换累加器 A 与操作数的内容。',
      flags: '无',
      explain: (o) => `交换 ${o[0]} 与 ${o[1]} 的内容。`,
    },
    XCHD: {
      description:
        'XCHD A,@Ri：只交换 A 与 @Ri 所指向字节的低 4 位（高 4 位不变）。',
      flags: '无',
      explain: (o) => `只交换 A 与 ${o[1]} 的低 4 位，高 4 位不变。`,
    },
    ACALL: {
      description:
        'ACALL addr11：绝对调用子程序，只能跳到与下一条指令同一个 2KB 页面内；返回地址（PC）会被压入堆栈。',
      flags: '无',
      explain: (o) =>
        `把当前 PC（下一条指令地址）压入堆栈，然后调用同一个 2KB 页面内的 ${o[0]}。`,
    },
    LCALL: {
      description:
        'LCALL addr16：长调用子程序，可跳到 64KB 程序空间内任何地址；返回地址（PC）会被压入堆栈。',
      flags: '无',
      explain: (o) => `把当前 PC（下一条指令地址）压入堆栈，然后调用 ${o[0]}。`,
    },
    RET: {
      description: 'RET：从子程序返回，把堆栈顶端的两个字节弹出并存回 PC。',
      flags: '无',
      explain: () =>
        '从堆栈弹出返回地址（2 字节）存回 PC，继续执行调用点之后的指令。',
    },
    RETI: {
      description:
        'RETI：从中断服务程序（ISR）返回，除了弹出返回地址，还会恢复中断优先级逻辑，允许同优先级的中断再次被响应。',
      flags: '无',
      explain: () =>
        '从堆栈弹出返回地址存回 PC，并清除“正在处理中断”状态，允许同优先级的中断再次触发。',
    },
    AJMP: {
      description:
        'AJMP addr11：绝对跳转，只能跳到与下一条指令同一个 2KB 页面内。',
      flags: '无',
      explain: (o) => `跳到同一个 2KB 页面内的 ${o[0]}。`,
    },
    LJMP: {
      description: 'LJMP addr16：长跳转，可跳到 64KB 程序空间内任何地址。',
      flags: '无',
      explain: (o) => `跳到 ${o[0]}。`,
    },
    SJMP: {
      description:
        'SJMP rel：相对跳转，偏移范围 −128~+127（以下一条指令地址为基准）。',
      flags: '无',
      explain: (o) => `相对跳转到 ${o[0]}（偏移需落在 −128~+127 范围内）。`,
    },
    JMP: {
      description:
        'JMP @A+DPTR：以 A 作偏移、DPTR 作基址的间接跳转，常用来实现跳转表。',
      flags: '无',
      explain: () => '跳到 A + DPTR 所指向的地址（常见于 switch/跳转表实现）。',
    },
    JZ: {
      description: 'JZ rel：若累加器 A 为 0 则相对跳转。',
      flags: '无',
      explain: (o) => `若 A 等于 0，跳到 ${o[0]}。`,
    },
    JNZ: {
      description: 'JNZ rel：若累加器 A 不为 0 则相对跳转。',
      flags: '无',
      explain: (o) => `若 A 不等于 0，跳到 ${o[0]}。`,
    },
    JC: {
      description: 'JC rel：若进位标志 C 为 1 则相对跳转。',
      flags: '无',
      explain: (o) => `若 Cy = 1，跳到 ${o[0]}。`,
    },
    JNC: {
      description: 'JNC rel：若进位标志 C 为 0 则相对跳转。',
      flags: '无',
      explain: (o) => `若 Cy = 0，跳到 ${o[0]}。`,
    },
    JB: {
      description: 'JB bit,rel：若指定的可寻址位为 1 则相对跳转。',
      flags: '无',
      explain: (o) => `若 ${o[0]} = 1，跳到 ${o[1]}。`,
    },
    JNB: {
      description: 'JNB bit,rel：若指定的可寻址位为 0 则相对跳转。',
      flags: '无',
      explain: (o) => `若 ${o[0]} = 0，跳到 ${o[1]}。`,
    },
    JBC: {
      description:
        'JBC bit,rel：若指定的可寻址位为 1 则跳转，并在跳转前把该位清为 0。',
      flags: '无',
      explain: (o) => `若 ${o[0]} = 1，先清除该位再跳到 ${o[1]}。`,
    },
    CJNE: {
      description:
        'CJNE：比较两个操作数，不相等则相对跳转；同时依比较结果设定进位标志 C（第一操作数 < 第二操作数时 Cy=1）。',
      flags: 'Cy',
      explain: (o) =>
        `比较 ${o[0]} 与 ${o[1]}，不相等则跳到 ${o[2]}；若 ${o[0]} < ${o[1]} 则设定 Cy。`,
    },
    DJNZ: {
      description:
        'DJNZ：操作数先减一，结果不为 0 则相对跳转，常用来实现循环计数。',
      flags: '无',
      explain: (o) => `${o[0]} 先减一，若结果不为 0 则跳到 ${o[1]}。`,
    },
    NOP: {
      description:
        'NOP：不做任何事，只消耗一个机器周期，常用于精确延时或对齐。',
      flags: '无',
      explain: () => '不执行任何动作，仅消耗 1 个机器周期。',
    },
  },
};
