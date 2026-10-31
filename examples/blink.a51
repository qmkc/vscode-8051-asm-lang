; Blink an LED on P1.0 - demo file for the 8051 Assembly extension.
; Open this file, then run "Format Document" to see the formatter in action.
$NOMOD51
$INCLUDE (REG51.INC)
        ORG     0H
LED:    BIT     P1.0

MAIN:
        MOV     R7,#255
LOOP1:  SETB    LED
        LCALL   DELAY
        CLR     LED
        LCALL   DELAY
        SJMP    MAIN                    ;awasd

DELAY:  MOV     R6,#0FFH
D1:     MOV     R5,#0FFH
D2:     DJNZ    R5,D2
        DJNZ    R6,D1
        RET

        END
