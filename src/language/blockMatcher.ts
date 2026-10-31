import { MACRO_DEF_RE, stripComment } from './parsing';

export type BlockKind = 'IF' | 'MACRO' | 'REPT' | 'WHILE';

export interface MatchedBlock {
  kind: BlockKind;
  startLine: number;
  endLine: number;
}

export interface UnmatchedEnd {
  keyword: 'ENDIF' | 'ENDM' | 'ENDW';
  line: number;
}

export interface UnclosedBlock {
  kind: BlockKind;
  line: number;
}

export interface BlockMatchResult {
  matched: MatchedBlock[];
  unmatchedEnds: UnmatchedEnd[];
  unclosed: UnclosedBlock[];
}

/** The line's leading keyword, for block matching. A macro definition is written "NAME MACRO ..." - the name, not MACRO itself, is the first word, so that form is checked before falling back to the line's own first word. */
function leadingKeyword(commentStrippedText: string): string | undefined {
  if (MACRO_DEF_RE.test(commentStrippedText)) {
    return 'MACRO';
  }
  return /^\s*([A-Za-z]+)\b/i.exec(commentStrippedText)?.[1]?.toUpperCase();
}

/** Matches MACRO/IF/REPT/WHILE blocks against their ENDM/ENDIF/ENDW across a flat list of lines, reporting well-formed pairs plus anything unbalanced. Shared by diagnostics (reports the unbalanced cases) and folding (folds the matched pairs). */
export function matchBlocks(lines: string[]): BlockMatchResult {
  const stack: UnclosedBlock[] = [];
  const matched: MatchedBlock[] = [];
  const unmatchedEnds: UnmatchedEnd[] = [];

  for (let line = 0; line < lines.length; line++) {
    const keyword = leadingKeyword(stripComment(lines[line]));
    if (!keyword) {
      continue;
    }

    if (
      keyword === 'IF' ||
      keyword === 'MACRO' ||
      keyword === 'REPT' ||
      keyword === 'WHILE'
    ) {
      stack.push({ kind: keyword, line });
      continue;
    }

    if (keyword === 'ENDIF') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'IF') {
        stack.pop();
        matched.push({ kind: 'IF', startLine: top.line, endLine: line });
      } else {
        unmatchedEnds.push({ keyword: 'ENDIF', line });
      }
    } else if (keyword === 'ENDM') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'MACRO' || top?.kind === 'REPT') {
        stack.pop();
        matched.push({ kind: top.kind, startLine: top.line, endLine: line });
      } else {
        unmatchedEnds.push({ keyword: 'ENDM', line });
      }
    } else if (keyword === 'ENDW') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'WHILE') {
        stack.pop();
        matched.push({ kind: 'WHILE', startLine: top.line, endLine: line });
      } else {
        unmatchedEnds.push({ keyword: 'ENDW', line });
      }
    }
  }

  return { matched, unmatchedEnds, unclosed: stack };
}
