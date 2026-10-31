# Change Log

All notable changes to the "8051 Assembly (A51)" extension will be documented in this file.

## [0.0.1]

Initial release.

- Syntax highlighting for 8051 (MCS-51) A51 assembly (`.asm`, `.a51`)
- Document and selection formatting, with configurable columns, case style, comma/semicolon spacing, long-label handling, macro-body indentation, and blank-line collapsing
- Diagnostics: unknown instructions/directives, wrong operand counts, unresolved branch targets, invalid `@Ri` indirect addressing, unmatched/unclosed `MACRO`/`IF`/`REPT`/`WHILE` blocks, and duplicate symbol definitions
- Hover reference with opcode, byte length, cycle count, flags, and addressing-mode notes
- Hover on any label/constant/macro reference shows its kind, value/parameters, defining line, and the doc comment written directly above its definition
- Snippets for common A51 patterns (reset vector, interrupt table, ISR, subroutine, macro, delay loop, `EQU`, `BIT`, `CJNE`)
- Auto-completion for instructions, directives, registers, and document symbols
- Go to Definition, Find All References, document outline, and code folding for `MACRO`/`IF`/`REPT`/`WHILE` blocks
- Localization: English, Simplified Chinese, and Traditional Chinese
