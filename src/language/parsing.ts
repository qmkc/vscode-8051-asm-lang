/**
 * Line-recognition regexes and helpers shared by the formatter, diagnostics,
 * hover provider, and symbol indexer, so all of them agree on what counts as
 * a label/assignment/macro/mnemonic line and on how to strip a trailing
 * comment.
 */

/** A label definition: `NAME:` optionally followed by the rest of the line. */
export const LABEL_DEF_RE = /^\s*([A-Za-z_?][A-Za-z0-9_?]*)\s*:\s*(.*)$/;

/** A colon-less symbol definition: `NAME EQU|SET|BIT|DATA|IDATA|XDATA|CODE|DBIT|SEGMENT ...`. */
export const ASSIGN_DEF_RE =
  /^\s*([A-Za-z_?][A-Za-z0-9_?]*)\s+(EQU|SET|BIT|DATA|IDATA|XDATA|CODE|DBIT|SEGMENT)\b\s*(.*)$/i;

/** A macro definition: `NAME MACRO ...`. */
export const MACRO_DEF_RE =
  /^\s*([A-Za-z_?][A-Za-z0-9_?]*)\s+(MACRO)\b\s*(.*)$/i;

/** The line's first word (mnemonic, directive, or macro call) and everything after it. Allows a leading `$` for compiler-control directives. */
export const MNEMONIC_RE = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(.*)$/;

/** A top-level `END` directive. */
export const END_RE = /^\s*END\b/i;

/** Index of the first top-level `END` directive line, or -1 if none. A51 stops assembling at `END`, so nothing after it is a real label/instruction/directive - callers that index symbols or validate code should stop there too. */
export function findEndLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const { code } = splitCodeAndComment(lines[i]);
    if (END_RE.test(code)) {
      return i;
    }
  }
  return -1;
}

/** Maps an ASSIGN_DEF_RE directive keyword to the symbol kind used for indexing and duplicate-definition checks. IDATA/XDATA/CODE/DBIT/SEGMENT are all storage-location definitions and are grouped under 'data'. */
export function classifyAssignKind(
  directive: string,
): 'equ' | 'set' | 'bit' | 'data' {
  const upper = directive.toUpperCase();
  if (upper === 'EQU') {
    return 'equ';
  }
  if (upper === 'SET') {
    return 'set';
  }
  if (upper === 'BIT') {
    return 'bit';
  }
  return 'data';
}

/** Splits a line into code and trailing comment, ignoring `;` inside '...'/"..." string literals. */
export function splitCodeAndComment(line: string): {
  code: string;
  comment: string;
} {
  let quoteChar: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      }
    } else if (ch === "'" || ch === '"') {
      quoteChar = ch;
    } else if (ch === ';') {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  return { code: line, comment: '' };
}

/** The code portion of a line, with any trailing `;` comment removed (quote-aware). */
export function stripComment(line: string): string {
  return splitCodeAndComment(line).code;
}

/** Replaces the contents of '...'/"..." string literals with spaces, preserving every character's position, so identifier scanning never matches text that is only inside a string literal. */
export function maskStringLiterals(code: string): string {
  let result = '';
  let quoteChar: string | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quoteChar) {
      result += ch === quoteChar ? ch : ' ';
      if (ch === quoteChar) {
        quoteChar = null;
      }
    } else if (ch === "'" || ch === '"') {
      quoteChar = ch;
      result += ch;
    } else {
      result += ch;
    }
  }
  return result;
}
