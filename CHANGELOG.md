# Change Log

All notable changes to the "8051 Assembly (A51)" extension will be documented in this file.

## [0.1.0]

- Diagnostics can now be disabled entirely (`a51.diagnostics.enable`), have their severity overridden or turned off by rule code everywhere (`a51.diagnostics.severity`, e.g. `{ "AS001": "off" }`; codes are prefixed `AS`/`AM` for syntax/semantic rules), or be suppressed for a single line with an `a51-disable-line`/`a51-disable-next-line` comment — useful for extended dialects (e.g. MCS-251/A251) whose instructions this checker doesn't recognize
- Quick fixes for each diagnostic: skip the line, disable the rule for this user, or disable it for this workspace
- "Did you mean '...'" quick fixes for `unknown-instruction` (`AS001`) typos, ranked by closeness
- Rename Symbol for labels, constants, and macros

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
