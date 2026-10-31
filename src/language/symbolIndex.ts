import * as vscode from 'vscode';

import {
  ASSIGN_DEF_RE,
  LABEL_DEF_RE,
  MACRO_DEF_RE,
  classifyAssignKind,
  extractDocComment,
  findEndLineIndex,
  stripComment,
} from './parsing';

export type SymbolKind = 'label' | 'equ' | 'set' | 'bit' | 'data' | 'macro';

export interface SymbolDef {
  name: string;
  kind: SymbolKind;
  line: number;
  character: number;
  length: number;
  /** The value expression (EQU/SET/BIT/.../SEGMENT) or parameter list (MACRO) written after the keyword, if any. */
  detail?: string;
  /** The contiguous `;` comment block directly above this definition, if any - treated as its documentation. */
  doc?: string;
}

/** Builds a symbol table for a single document (labels, EQU/SET/BIT constants, macros). A51 stops assembling at a top-level `END`, so anything after it is never indexed. */
export function indexDocument(
  doc: vscode.TextDocument,
): Map<string, SymbolDef[]> {
  const index = new Map<string, SymbolDef[]>();

  const add = (def: SymbolDef) => {
    const key = def.name.toUpperCase();
    const list = index.get(key) ?? [];
    list.push(def);
    index.set(key, list);
  };

  const lines: string[] = [];
  for (let line = 0; line < doc.lineCount; line++) {
    lines.push(doc.lineAt(line).text);
  }
  const endIdx = findEndLineIndex(lines);
  const lastLine = endIdx === -1 ? lines.length - 1 : endIdx;

  for (let line = 0; line <= lastLine; line++) {
    const raw = lines[line];
    const text = stripComment(raw);

    const macroMatch = MACRO_DEF_RE.exec(text);
    if (macroMatch) {
      add({
        name: macroMatch[1],
        kind: 'macro',
        line,
        character: macroMatch.index + macroMatch[0].indexOf(macroMatch[1]),
        length: macroMatch[1].length,
        detail: macroMatch[3]?.trim() || undefined,
        doc: extractDocComment(lines, line),
      });
      continue;
    }

    const assignMatch = ASSIGN_DEF_RE.exec(text);
    if (assignMatch) {
      add({
        name: assignMatch[1],
        kind: classifyAssignKind(assignMatch[2]),
        line,
        character: assignMatch.index + assignMatch[0].indexOf(assignMatch[1]),
        length: assignMatch[1].length,
        detail: assignMatch[3]?.trim() || undefined,
        doc: extractDocComment(lines, line),
      });
      continue;
    }

    const labelMatch = LABEL_DEF_RE.exec(text);
    if (labelMatch) {
      add({
        name: labelMatch[1],
        kind: 'label',
        line,
        character: text.indexOf(labelMatch[1]),
        length: labelMatch[1].length,
        doc: extractDocComment(lines, line),
      });
    }
  }

  return index;
}
