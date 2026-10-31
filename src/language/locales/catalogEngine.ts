import { OperandType } from '../opcodeTable';
import { SymbolKind } from '../symbolIndex';
import { LocaleCatalog, LocaleCode, MnemonicProse } from './types';

/** Substitutes `{0}`, `{1}`, ... in `template` with the corresponding entries of `args`. */
function format(template: string, args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (whole, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? whole : String(value);
  });
}

/** How each OperandType's raw operand text needs transforming before being substituted into its describeOperand template - e.g. `Rn`/`@Ri` are upper-cased, `notbit` drops its leading `/`. Locale-independent: only the wording is locale data, this dispatch is not. */
const OPERAND_TEXT_TRANSFORM: Partial<
  Record<OperandType, (text: string) => string>
> = {
  Rn: (text) => text.toUpperCase(),
  '@Ri': (text) => text.toUpperCase(),
  notbit: (text) => text.slice(1),
};

/** An `explain` template that reads the same regardless of operand identity, or one that overrides its wording when the first operand is a specific OperandType (e.g. ANL/ORL/MOV read differently when operand 0 is the carry flag `C`; MOVX reads differently when it's accumulator `A`). */
export type ExplainSpec =
  | string
  | { default: string; whenFirstType?: Partial<Record<OperandType, string>> };

export interface InstructionData {
  description: string;
  flags: string;
  explain: ExplainSpec;
}

export interface LocaleUiData {
  headingWithLabel: string;
  headingNoLabel: string;
  opcodeTableHeader: string;
  operandTableHeader: string;
  flagsLabel: string;
  noMatchIntro: string;
  noneOperand: string;
  byteUnitOne: string;
  byteUnitMany: string;
  callPseudoInstruction: string;
  symbolKindLabel: Record<SymbolKind, string>;
  definedAtLine: string;
}

/** The shape produced by `scripts/build-locales.js` from a locale's YAML source - see src/language/locales/data/*.yaml. */
export interface LocaleData {
  notes: Record<string, string>;
  describeOperand: Record<OperandType, string>;
  ui: LocaleUiData;
  instructions: Record<string, InstructionData>;
}

function buildExplain(spec: ExplainSpec): MnemonicProse['explain'] {
  if (typeof spec === 'string') {
    return (ops) => format(spec, ops);
  }
  return (ops, types) => {
    const override = spec.whenFirstType?.[types[0]];
    return format(override ?? spec.default, ops);
  };
}

/** Builds a full, locale-agnostic LocaleCatalog from the data compiled out of one locale's YAML source. The only locale-specific thing here is `data` - every function below is identical across locales, which is the whole point of moving the wording out of TypeScript. */
export function buildCatalog(
  code: LocaleCode,
  data: LocaleData,
): LocaleCatalog {
  const instructions: LocaleCatalog['instructions'] = {};
  for (const [mnemonic, entry] of Object.entries(data.instructions)) {
    instructions[mnemonic] = {
      description: entry.description,
      flags: entry.flags,
      explain: buildExplain(entry.explain),
    };
  }

  return {
    code,
    notes: data.notes,
    describeOperand: (text, type) => {
      const transform = OPERAND_TEXT_TRANSFORM[type];
      return format(data.describeOperand[type], [
        transform ? transform(text) : text,
      ]);
    },
    ui: {
      heading: (mo, label) =>
        label
          ? format(data.ui.headingWithLabel, [mo, label])
          : format(data.ui.headingNoLabel, [mo]),
      opcodeTableHeader: data.ui.opcodeTableHeader,
      operandTableHeader: data.ui.operandTableHeader,
      flagsLabel: (flags) => format(data.ui.flagsLabel, [flags]),
      noMatchIntro: (mnemonic, operandText) =>
        format(data.ui.noMatchIntro, [mnemonic, operandText]),
      noneOperand: data.ui.noneOperand,
      byteUnit: (bytes) =>
        format(bytes > 1 ? data.ui.byteUnitMany : data.ui.byteUnitOne, [bytes]),
      callPseudoInstruction: data.ui.callPseudoInstruction,
      symbolKindLabel: (kind) => data.ui.symbolKindLabel[kind],
      definedAtLine: (line) => format(data.ui.definedAtLine, [line]),
    },
    instructions,
  };
}
