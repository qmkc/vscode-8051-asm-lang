$NOMOD51
   $INCLUDE (REG51.INC)
;==============================================
; Formatter stress test for 8051 Assembly (.a51)
;==============================================
#define   BAUD_RELOAD   0FDH

LED     BIT P1.0
   BUZZER	bit	P1.1
COUNT   EQU   30H
flags   DATA  20H
BUF_LEN SET 16
VERY_LONG_SYMBOL_NAME EQU 40H

   


DELAYM  MACRO   N
    MOV R7,#N
    DJNZ R7,$
  ENDM

	CSEG AT 0000H
        LJMP   START
        ORG 0023H
	LJMP  UART_ISR    ;serial interrupt vector

        ORG 0100H
START:	MOV SP,#5FH
  mov   a , #0ffh    ; lower-case + spaces around comma
        MOV   R0 ,#BUF_LEN
        MOV TMOD,#20H
        MOV TH1,#BAUD_RELOAD
        SETB TR1
        ANL C,  /BUZZER
        MOV @R0,A
        MOV DPTR,#TABLE+1
        MOVC A,@A+DPTR
        MOV A,#HIGH(TABLE)   ; expression stays as-is
        DELAYM 5
VeryLongLabelName_Exceeds:  NOP
LOOP:   SETB LED   
        ACALL DELAY_10MS
        CLR LED   ;   spaces   inside   comment   stay
        DJNZ R0,   LOOP
        MOV A,#'a'
        CJNE A,#',',SKIP   ; char literal comma
        SJMP START                                                    ; far-right comment
SKIP:
        NOP
            ; indented full-line comment
DELAY_10MS:
        MOV   R6, #20
D1:     MOV R5,#248
D2:     DJNZ R5,D2
        DJNZ R6,D1
        RET

UART_ISR:
	PUSH ACC
	PUSH PSW
	CLR RI
	POP PSW
	POP ACC
	RETI

TABLE:  DB 'a;b,c', 0, 1,2 ,3
        DB 'x, y ; z'    ;string with ; and ,
        DW 1234H,0ABCDH
MSG:    DB      'Hello, 8051!',0DH,0AH,0

?PR?TEST SEGMENT CODE
        RSEG ?PR?TEST
        NOP
        END
   text after END   ,  must  stay   untouched ;x
