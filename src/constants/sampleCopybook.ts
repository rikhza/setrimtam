export const SAMPLE_COPYBOOK = `01  INBOUND-MESSAGE.
   4       05  SME-CICS-TRANS                 PIC X(04) VALUE 'SME6'.
   9       05  SME-WSID                       PIC X(05) VALUE '95088'.
  12       05  SME-TXN-CODE                   PIC X(03).
               88 TXN-DOMESTIC-TRANS                    VALUE '802'.
               88 TXN-MFTS-AUTOCR-KU-MP                 VALUE '801'.
               88 TXN-MFTS-AUTOCR-KU-SP                 VALUE '811'.
  23       05  SME-TXN-REF-NO                 PIC 9(11).
  33       05  SME-ACCNO-FR                   PIC 9(10).
A15095*    05  SME-ACCNO-TO                   PIC X(16).
A15095     05  SME-ACCNO-TO                   PIC X(34).
  50       05  SME-LOG-TYPE                   PIC X(01).
               88 SME-WTH-MODE                     VALUE 'L'.
               88 SME-INQ-MODE                     VALUE 'I'.
  65       05  SME-AMT-XCHANGE                PIC 9(13)V99.
  80       05  SME-AMT-INPUT                  PIC 9(13)V99.
  89       05  SME-AMT-KURS                   PIC 9(07)V99.
 104       05  SME-AMT-CHARGES                PIC 9(13)V99.
 107       05  SME-CURR-SYMBL                 PIC X(03).
 115       05  SME-BUSN-DATE                  PIC 9(08).
 119       05  SME-SERV-BRANCH                PIC 9(04).
 149       05  SME-TRF-DESC1                  PIC X(30).
 179       05  SME-TRF-DESC2                  PIC X(30).
A15095     05  SME-RECV-CITY-CODE             PIC 9(04).
 190       05  SME-RECV-BANK-CD-BI            PIC X(07).
 225       05  SME-RECV-BANK-NAME             PIC X(35).
A15095     05  SME-RECV-NAME                  PIC X(70).
 295       05  SME-RECV-ADDR1                 PIC X(35).
A24191     05  SME-REFF-NO                    PIC X(35).`;
