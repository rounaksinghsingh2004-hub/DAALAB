# Project report — DNA Sequence Similarity Analyzer

## Architecture
The browser sends sequences to one Spring Boot application. Java validates and normalizes the data, computes authoritative results, and optionally emits a bounded cell-by-cell trace. The browser only renders that response.

## Algorithms and metrics
All six variants are implemented from scratch. LCS uses `1 + diagonal` on matches and `max(up,left)` otherwise. Levenshtein uses zero-cost diagonal matches and minimum-cost insert/delete/substitute transitions. All are O(mn) time. Full tables use O(mn) space; rolling rows use O(min(m,n)). LCS similarity is `2L/(m+n) × 100`; edit similarity is `(1-D/max(m,n)) × 100`, with both-empty set to 100%.

## Determinism and limits
LCS traceback chooses up before left on ties. Edit traceback chooses match, substitution, deletion, insertion in that order. Inputs are capped at 2,000 bases per strand. Detailed matrix traces are capped at 30 bases per strand.

## Team contributions
Assign actual team names and contributions before submission; no student details were invented.
