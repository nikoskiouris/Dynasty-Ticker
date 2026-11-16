# Ticket 044: single value system verification

Acceptance: every player and pick uses the same 12-team Superflex PPR dynasty map regardless of league settings; retired format links still open with an explanation; no format controls remain.

Generated the SF-only snapshot from current upstream inputs. Changes below include the replacement-baseline change and any upstream refresh since the prior snapshot; they are not isolated causal estimates.

| Asset | Position | Before rank | After rank | Before value | After value |
| --- | --- | ---: | ---: | ---: | ---: |
| Jaxon Smith-Njigba | WR | 1 | 1 | 18052 | 18183 |
| Ashton Jeanty | RB | 3 | 2 | 13328 | 13348 |
| Jahmyr Gibbs | RB | 4 | 3 | 13229 | 13258 |
| Josh Allen | QB | 5 | 4 | 13012 | 13012 |
| Bijan Robinson | RB | 6 | 5 | 12585 | 12615 |
| Matthew Golden | WR | 8 | 6 | 12303 | 12421 |
| CeeDee Lamb | WR | 7 | 7 | 12313 | 12420 |
| Ja'Marr Chase | WR | 9 | 8 | 12265 | 12372 |
| Puka Nacua | WR | 2 | 9 | 14349 | 12333 |
| Tetairoa McMillan | WR | 10 | 10 | 11983 | 12124 |
| Drake Maye | QB | 11 | 11 | 11581 | 11581 |
| Amon-Ra St. Brown | WR | 13 | 12 | 11419 | 11504 |
| Trey McBride | TE | 12 | 13 | 11450 | 11495 |
| Joe Burrow | QB | 14 | 14 | 11247 | 11247 |
| Chris Olave | WR | 16 | 15 | 10910 | 11008 |
| Kenneth Walker III | RB | 15 | 16 | 10924 | 10938 |
| Brock Bowers | TE | 17 | 17 | 10845 | 10904 |
| Brock Purdy | QB | 18 | 18 | 10441 | 10441 |
| Jordan Love | QB | 19 | 19 | 10303 | 10303 |
| Bucky Irving | RB | 20 | 20 | 10114 | 10071 |
| Kyren Williams | RB | 21 | 21 | 9993 | 10010 |
| 2027 Early 1st | PICK | 22 | 22 | 9961 | 9971 |
| Luther Burden III | WR | 23 | 23 | 9903 | 9932 |
| Christian Watson | WR | 24 | 24 | 9655 | 9715 |
| Tee Higgins | WR | 25 | 25 | 9457 | 9511 |
| Malik Nabers | WR | 26 | 26 | 9452 | 9471 |
| Trevor Lawrence | QB | 27 | 27 | 9409 | 9409 |
| Patrick Mahomes | QB | 28 | 28 | 9168 | 9168 |
| C.J. Stroud | QB | 29 | 29 | 9143 | 9143 |
| Javonte Williams | RB | 30 | 30 | 9134 | 9131 |
| Dak Prescott | QB | 31 | 31 | 9011 | 9011 |
| Zay Flowers | WR | 32 | 32 | 8837 | 8886 |
| Jared Goff | QB | 34 | 33 | 8703 | 8853 |
| James Cook III | RB | 33 | 34 | 8824 | 8827 |
| Carnell Tate | WR | 35 | 35 | 8661 | 8651 |
| Jonathan Taylor | RB | 36 | 36 | 8506 | 8506 |
| 2028 Early 1st | PICK | 38 | 37 | 8466 | 8475 |
| Caleb Williams | QB | 37 | 38 | 8471 | 8471 |
| Christian McCaffrey | RB | 39 | 39 | 8203 | 8217 |
| George Pickens | WR | 40 | 40 | 8102 | 8142 |
| Drake London | WR | 41 | 41 | 8080 | 8096 |
| Tyler Warren | TE | 42 | 42 | 7743 | 7732 |
| KC Concepcion Jr. | WR | 43 | 43 | 7499 | 7522 |
| 2027 Round 1 | PICK | 44 | 44 | 7380 | 7395 |
| Fernando Mendoza | QB | 45 | 45 | 7290 | 7290 |
| 2029 Early 1st | PICK | 46 | 46 | 7196 | 7204 |
| Denzel Boston | WR | 48 | 47 | 7011 | 7031 |
| Harold Fannin Jr. | TE | 47 | 48 | 7041 | 7021 |
| D'Andre Swift | RB | 49 | 49 | 6882 | 6873 |
| 2027 Mid 1st | PICK | 50 | 50 | 6758 | 6774 |

The top-50 table includes any skill-position rank/value movement. Old price-history files are preserved unchanged. New archives contain only asOf and sf.

Manual CLI: regenerated 884 SF assets (836 players, 728 positive player prices); market-file integrity validation passed; legacy q code decoded to sf; requested retired encoding produced an s code; 10-team 1QB league produced the warning and 12-team SF PPR league produced no mismatch warning.

No unit tests or automated test suites were added or run. Responsive browser verification and demo are recorded with the integrated redesign.
