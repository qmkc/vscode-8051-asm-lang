import { OperandType } from '../opcodeTable';
import { SymbolKind } from '../symbolIndex';

export type LocaleCode = 'en' | 'zh-tw' | 'zh-cn';

export interface MnemonicProse {
  description: string;
  flags: string;
  /** Builds the operand-specific explanation from each operand's resolved phrase and its OperandType, both in encoding.operands order. */
  explain: (ops: string[], types: OperandType[]) => string;
}

export interface LocaleUi {
  /** "MOV @R0,A" + (label ? " — located in LOOP" : "") */
  heading: (mnemonicAndOperands: string, label: string | undefined) => string;
  opcodeTableHeader: string;
  operandTableHeader: string;
  flagsLabel: (flags: string) => string;
  noMatchIntro: (mnemonic: string, operandText: string) => string;
  noneOperand: string;
  byteUnit: (bytes: number) => string;
  callPseudoInstruction: string;
  symbolKindLabel: (kind: SymbolKind) => string;
  definedAtLine: (line: number) => string;
}

export interface LocaleCatalog {
  code: LocaleCode;
  instructions: Record<string, MnemonicProse>;
  describeOperand: (text: string, type: OperandType) => string;
  /** Keyed by the same note ids buildNotes() in hoverLogic.ts selects. */
  notes: Record<string, string>;
  ui: LocaleUi;
}
