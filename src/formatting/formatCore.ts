import { REGISTERS } from '../language/instructionSet';
import {
  ASSIGN_DEF_RE,
  LABEL_DEF_RE,
  MACRO_DEF_RE,
  MNEMONIC_RE,
  findEndLineIndex,
  splitCodeAndComment,
} from '../language/parsing';

export { findEndLineIndex };

export type IndentStyle = 'spaces' | 'tabs';
export type CaseStyle = 'preserve' | 'upper' | 'lower';
export type CommaSpacing = 'preserve' | 'space';
export type SemicolonSpacing = 'preserve' | 'space';
export type LongLabelStyle = 'newline' | 'sameLine';

export interface FormatOptions {
  mnemonicColumn: number;
  operandColumn: number;
  commentColumn: number;
  indentStyle: IndentStyle;
  tabSize: number;
  longLabelStyle: LongLabelStyle;
  caseStyle: CaseStyle;
  commaSpacing: CommaSpacing;
  semicolonSpacing: SemicolonSpacing;
  indentMacroBody: boolean;
  maxBlankLines: number;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  mnemonicColumn: 8,
  operandColumn: 16,
  commentColumn: 40,
  indentStyle: 'spaces',
  tabSize: 8,
  longLabelStyle: 'newline',
  caseStyle: 'preserve',
  commaSpacing: 'preserve',
  semicolonSpacing: 'preserve',
  indentMacroBody: false,
  maxBlankLines: 1,
};

const REGISTER_SET = new Set(REGISTERS.map((r) => r.toUpperCase()));

interface Columns {
  mnemonicColumn: number;
  operandColumn: number;
  commentColumn: number;
}

function applyCase(token: string, style: CaseStyle): string {
  if (style === 'upper') {
    return token.toUpperCase();
  }
  if (style === 'lower') {
    return token.toLowerCase();
  }
  return token;
}

function isBannerComment(comment: string): boolean {
  const rest = comment.slice(1).trim();
  return rest.length > 0 && /^[;=\-_*#~]+$/.test(rest);
}

function formatComment(comment: string, options: FormatOptions): string {
  if (!comment) {
    return '';
  }
  if (options.semicolonSpacing !== 'space') {
    return comment;
  }
  const body = comment.slice(1);
  const trimmedBody = body.replace(/^[ \t]+/, '');
  if (trimmedBody.length === 0) {
    return comment;
  }
  return '; ' + trimmedBody;
}

/** Amount of whitespace/tab padding needed to go from visual column `col` to `target`. */
function padding(
  col: number,
  target: number,
  options: FormatOptions,
): { pad: string; col: number } {
  if (col >= target) {
    return { pad: ' ', col: col + 1 };
  }
  if (options.indentStyle === 'tabs') {
    let pad = '';
    let c = col;
    for (;;) {
      const next = (Math.floor(c / options.tabSize) + 1) * options.tabSize;
      if (next > target) {
        break;
      }
      pad += '\t';
      c = next;
    }
    if (c < target) {
      pad += ' '.repeat(target - c);
      c = target;
    }
    return { pad, col: c };
  }
  return { pad: ' '.repeat(target - col), col: target };
}

/** Splits operand text on commas outside string literals ('...'/"...") and outside parens. */
function splitTopLevelByComma(text: string): string[] {
  const segments: string[] = [];
  let quoteChar: string | null = null;
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      }
    } else if (ch === "'" || ch === '"') {
      quoteChar = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ',' && depth === 0) {
      segments.push(text.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(text.slice(start));
  return segments;
}

/** Transforms one comma-free operand segment: register-case and numeric-suffix case outside string literals. Leaves user symbol names, literal content, and anything inside parens' quotes/case untouched beyond that. */
function transformSegment(segment: string, options: FormatOptions): string {
  let result = '';
  let quoteChar: string | null = null;
  let i = 0;

  while (i < segment.length) {
    const ch = segment[i];

    if (quoteChar) {
      result += ch;
      if (ch === quoteChar) {
        quoteChar = null;
      }
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quoteChar = ch;
      result += ch;
      i++;
      continue;
    }

    const rest = segment.slice(i);

    const numMatch = /^[0-9][0-9A-Fa-f]*([HhBbOoQqDd]?)/.exec(rest);
    if (numMatch) {
      const suffix = numMatch[1];
      const digits = numMatch[0].slice(0, numMatch[0].length - suffix.length);
      const newSuffix = suffix ? applyCase(suffix, options.caseStyle) : '';
      result += digits + newSuffix;
      i += numMatch[0].length;
      continue;
    }

    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (identMatch) {
      const word = identMatch[0];
      if (
        options.caseStyle !== 'preserve' &&
        REGISTER_SET.has(word.toUpperCase())
      ) {
        result += applyCase(word, options.caseStyle);
      } else {
        result += word;
      }
      i += word.length;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/** Splits operand text on top-level commas, trims each operand, transforms reserved words, and rejoins with "," or ", " per commaSpacing. */
function transformOperands(
  operandText: string,
  options: FormatOptions,
): string {
  const segments = splitTopLevelByComma(operandText).map((seg) =>
    transformSegment(seg.trim(), options),
  );
  const separator = options.commaSpacing === 'space' ? ', ' : ',';
  return segments.join(separator);
}

function formatFields(
  labelText: string | null,
  mnemonicToken: string,
  operandOut: string,
  commentOut: string,
  cols: Columns,
  options: FormatOptions,
  allowLineSplit = true,
): string[] {
  if (
    allowLineSplit &&
    labelText &&
    mnemonicToken &&
    options.longLabelStyle === 'newline' &&
    labelText.length + 1 > cols.mnemonicColumn
  ) {
    return [
      labelText,
      ...formatFields(
        null,
        mnemonicToken,
        operandOut,
        commentOut,
        cols,
        options,
      ),
    ];
  }

  let out = labelText ?? '';
  let col = out.length;

  if (mnemonicToken) {
    const p = padding(col, cols.mnemonicColumn, options);
    out += p.pad;
    col = p.col;
    out += mnemonicToken;
    col += mnemonicToken.length;
  }

  if (operandOut) {
    const p = padding(col, cols.operandColumn, options);
    out += p.pad;
    col = p.col;
    out += operandOut;
    col += operandOut.length;
  }

  if (commentOut) {
    const p = padding(col, cols.commentColumn, options);
    out += p.pad;
    col = p.col;
    out += commentOut;
  }

  return [out];
}

function formatPinnedLine(
  text: string,
  commentOut: string,
  cols: Columns,
  options: FormatOptions,
): string[] {
  if (!commentOut) {
    return [text];
  }
  const p = padding(text.length, cols.commentColumn, options);
  return [text + p.pad + commentOut];
}

function formatPinnedLineAtMnemonicCol(
  commentOut: string,
  cols: Columns,
  options: FormatOptions,
): string[] {
  const p = padding(0, cols.mnemonicColumn, options);
  return [p.pad + commentOut];
}

function trimTrailing(line: string): string {
  return line.replace(/[ \t]+$/, '');
}

function formatOneLine(
  rawLine: string,
  options: FormatOptions,
  cols: Columns,
): string[] {
  const { code, comment } = splitCodeAndComment(rawLine);
  const trimmedCode = code.trim();
  const commentOut = formatComment(comment, options);

  if (trimmedCode.length === 0) {
    if (!comment) {
      return [''];
    }
    if (isBannerComment(comment)) {
      return [trimTrailing(rawLine)];
    }
    const indentLen = code.length - code.replace(/^[ \t]*/, '').length;
    if (indentLen === 0) {
      return [commentOut];
    }
    return formatPinnedLineAtMnemonicCol(commentOut, cols, options);
  }

  if (trimmedCode.startsWith('$') || trimmedCode.startsWith('#')) {
    return formatPinnedLine(trimmedCode, commentOut, cols, options);
  }

  const assignMatch = ASSIGN_DEF_RE.exec(code);
  if (assignMatch) {
    const name = assignMatch[1];
    const keyword = applyCase(assignMatch[2], options.caseStyle);
    const operandOut = transformOperands(assignMatch[3].trim(), options);
    // A51 requires a colon-less symbol definition's name and mnemonic to stay on one line.
    return formatFields(
      name,
      keyword,
      operandOut,
      commentOut,
      cols,
      options,
      false,
    );
  }

  const macroMatch = MACRO_DEF_RE.exec(code);
  if (macroMatch) {
    const name = macroMatch[1];
    const keyword = applyCase(macroMatch[2], options.caseStyle);
    const operandOut = transformOperands(macroMatch[3].trim(), options);
    return formatFields(
      name,
      keyword,
      operandOut,
      commentOut,
      cols,
      options,
      false,
    );
  }

  const labelMatch = LABEL_DEF_RE.exec(code);
  if (labelMatch) {
    const name = labelMatch[1];
    const restAfterLabel = labelMatch[2];
    if (restAfterLabel.trim().length === 0) {
      return formatFields(`${name}:`, '', '', commentOut, cols, options);
    }
    const mnemonicMatch = MNEMONIC_RE.exec(restAfterLabel);
    if (!mnemonicMatch || !mnemonicMatch[1]) {
      return [trimTrailing(rawLine)];
    }
    const mnemonicToken = applyCase(mnemonicMatch[1], options.caseStyle);
    const operandOut = transformOperands(
      (mnemonicMatch[2] ?? '').trim(),
      options,
    );
    return formatFields(
      `${name}:`,
      mnemonicToken,
      operandOut,
      commentOut,
      cols,
      options,
    );
  }

  const mnemonicMatch = MNEMONIC_RE.exec(code);
  if (!mnemonicMatch || !mnemonicMatch[1]) {
    return [trimTrailing(rawLine)];
  }
  const mnemonicToken = applyCase(mnemonicMatch[1], options.caseStyle);
  const operandOut = transformOperands(
    (mnemonicMatch[2] ?? '').trim(),
    options,
  );
  return formatFields(
    null,
    mnemonicToken,
    operandOut,
    commentOut,
    cols,
    options,
  );
}

function effectiveColumns(options: FormatOptions, depth: number): Columns {
  if (!options.indentMacroBody || depth <= 0) {
    return {
      mnemonicColumn: options.mnemonicColumn,
      operandColumn: options.operandColumn,
      commentColumn: options.commentColumn,
    };
  }
  const step = options.operandColumn - options.mnemonicColumn;
  const shift = depth * step;
  return {
    mnemonicColumn: options.mnemonicColumn + shift,
    operandColumn: options.operandColumn + shift,
    commentColumn: options.commentColumn + shift,
  };
}

/** Best-effort nesting depth per line for MACRO/IF/REPT/WHILE blocks (used only when indentMacroBody is on). */
function computeDepths(lines: string[]): number[] {
  const depths: number[] = [];
  const stack: string[] = [];

  for (const raw of lines) {
    const { code } = splitCodeAndComment(raw);
    const trimmedCode = code.trim();
    let depth = stack.length;

    if (
      trimmedCode.length > 0 &&
      !trimmedCode.startsWith('$') &&
      !trimmedCode.startsWith('#')
    ) {
      const macroMatch = MACRO_DEF_RE.exec(code);
      let keyword = '';
      if (macroMatch) {
        keyword = 'MACRO';
      } else {
        const labelMatch = LABEL_DEF_RE.exec(code);
        const bodyText = labelMatch ? labelMatch[2] : code;
        const m = MNEMONIC_RE.exec(bodyText);
        if (m) {
          keyword = m[1].toUpperCase();
        }
      }

      if (
        keyword === 'IF' ||
        keyword === 'MACRO' ||
        keyword === 'REPT' ||
        keyword === 'WHILE'
      ) {
        depth = stack.length;
        stack.push(keyword);
      } else if (
        keyword === 'ENDIF' ||
        keyword === 'ENDM' ||
        keyword === 'ENDW'
      ) {
        depth = Math.max(0, stack.length - 1);
        if (stack.length > 0) {
          stack.pop();
        }
      }
    }

    depths.push(depth);
  }

  return depths;
}

function collapseBlankRuns(lines: string[], maxBlank: number): string[] {
  const result: string[] = [];
  let run = 0;
  for (const line of lines) {
    if (line === '') {
      run++;
      if (run <= maxBlank) {
        result.push(line);
      }
    } else {
      run = 0;
      result.push(line);
    }
  }
  return result;
}

/** Formats a flat block of lines (no END-tail awareness) - used for Format Selection. */
export function formatLines(lines: string[], options: FormatOptions): string[] {
  const depths = options.indentMacroBody
    ? computeDepths(lines)
    : lines.map(() => 0);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = effectiveColumns(options, depths[i]);
    out.push(...formatOneLine(lines[i], options, cols));
  }
  return collapseBlankRuns(out, options.maxBlankLines);
}

export function splitWithTrailingNewline(
  text: string,
  eol: string,
): { lines: string[]; hasTrailingNewline: boolean } {
  if (text.length === 0) {
    return { lines: [], hasTrailingNewline: false };
  }
  const hasTrailingNewline = text.endsWith(eol);
  const rawLines = text.split(eol);
  const lines = hasTrailingNewline ? rawLines.slice(0, -1) : rawLines;
  return { lines, hasTrailingNewline };
}

/** Formats a whole document: content after a top-level `END` is preserved byte-for-byte. */
export function formatText(
  fullText: string,
  eol: string,
  options: FormatOptions,
): string {
  if (fullText.length === 0) {
    return '';
  }

  const { lines: contentLines, hasTrailingNewline } = splitWithTrailingNewline(
    fullText,
    eol,
  );

  const endIdx = findEndLineIndex(contentLines);
  const headLines =
    endIdx === -1 ? contentLines : contentLines.slice(0, endIdx + 1);
  const tailLines = endIdx === -1 ? [] : contentLines.slice(endIdx + 1);

  const formattedHead = formatLines(headLines, options);
  const resultLines = formattedHead.concat(tailLines);

  const forceTrailingNewline = tailLines.length === 0;
  const trailing = forceTrailingNewline ? eol : hasTrailingNewline ? eol : '';

  return resultLines.join(eol) + trailing;
}
