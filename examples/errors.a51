; Intentionally broken file - demonstrates the diagnostics the extension reports.
        ORG     0H

START:
        MOVE    A,#10                   ; typo: 'MOVE' is not a valid 8051 instruction
        ADD     A                       ; ADD expects 2 operands, only 1 given
        SJMP    START

START:                                  ; error: 'START' is already defined above
        NOP

        IF      1
        MOV     A,#1
; missing ENDIF on purpose

        END
