package edu.daa.dna.service;

import edu.daa.dna.algorithm.DynamicProgramming;
import edu.daa.dna.model.ApiModels.*;
import edu.daa.dna.validation.SequenceValidator;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AnalysisService {
  private final SequenceValidator validator;
  public AnalysisService(SequenceValidator validator) { this.validator = validator; }

  public AnalysisResponse analyze(AnalyzeRequest request) {
    String a = validator.normalize(request.sequenceA()), b = validator.normalize(request.sequenceB());
    String lcsVariant = variant(request.lcsVariant()), editVariant = variant(request.editVariant());
    if ((lcsVariant.equals("MEMOIZATION") || editVariant.equals("MEMOIZATION")) && Math.max(a.length(), b.length()) > 500)
      throw new IllegalArgumentException("Memoization is limited to 500 bases per sequence for recursion safety. Choose full-table DP or rolling rows for longer inputs.");
    boolean traceAvailable = request.includeTrace() && a.length() <= 30 && b.length() <= 30;
    List<TraceEvent> trace = new ArrayList<>();
    int[][] lcsTable = buildLcsTable(a, b, traceAvailable ? trace : null);
    int[][] editTable = buildEditTable(a, b, traceAvailable ? trace : null);
    int lcsLength = lcsLength(lcsVariant, a, b, lcsTable);
    int editDistance = editDistance(editVariant, a, b, editTable);
    List<Position> matches = new ArrayList<>();
    StringBuilder sequence = new StringBuilder();
    for (int i = a.length(), j = b.length(); i > 0 && j > 0;) {
      if (a.charAt(i - 1) == b.charAt(j - 1)) { sequence.append(a.charAt(i - 1)); matches.add(new Position(i, j, "" + a.charAt(i - 1))); i--; j--; }
      else if (lcsTable[i - 1][j] >= lcsTable[i][j - 1]) i--;
      else j--;
    }
    Collections.reverse(matches); sequence.reverse();
    List<EditOperation> operations = edits(a, b, editTable);
    boolean includeTables = request.includeTables() && a.length() <= 30 && b.length() <= 30;
    return new AnalysisResponse(a, b, a.length(), b.length(), sequence.toString(), lcsLength, matches,
        lcsSimilarity(lcsLength, a.length(), b.length()), editDistance,
        editSimilarity(editDistance, a.length(), b.length()), operations, lcsVariant, editVariant,
        algorithmInfo(), includeTables ? lcsTable : null, includeTables ? editTable : null, traceAvailable ? trace : List.of(), traceAvailable);
  }

  private String variant(String raw) {
    String value = raw == null ? "TABULATION" : raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    if (value.equals("FULL_TABLE_DP") || value.equals("FULL_TABLE")) value = "TABULATION";
    if (!Set.of("MEMOIZATION", "TABULATION", "ROLLING_ROWS").contains(value)) throw new IllegalArgumentException("Choose memoization, full-table DP, or rolling rows.");
    return value;
  }
  private int lcsLength(String v, String a, String b, int[][] table) { return switch (v) { case "MEMOIZATION" -> DynamicProgramming.lcsMemo(a, b); case "ROLLING_ROWS" -> DynamicProgramming.lcsRolling(a, b); default -> table[a.length()][b.length()]; }; }
  private int editDistance(String v, String a, String b, int[][] table) { return switch (v) { case "MEMOIZATION" -> DynamicProgramming.editMemo(a, b); case "ROLLING_ROWS" -> DynamicProgramming.editRolling(a, b); default -> table[a.length()][b.length()]; }; }
  private List<AlgorithmInfo> algorithmInfo() { return List.of(
      new AlgorithmInfo("LCS memoization", "O(mn)", "O(mn) + stack"), new AlgorithmInfo("LCS tabulation", "O(mn)", "O(mn)"),
      new AlgorithmInfo("LCS rolling rows", "O(mn)", "O(min(m,n))"), new AlgorithmInfo("Edit memoization", "O(mn)", "O(mn) + stack"),
      new AlgorithmInfo("Edit tabulation", "O(mn)", "O(mn)"), new AlgorithmInfo("Edit rolling rows", "O(mn)", "O(min(m,n))")); }

  private List<EditOperation> edits(String a, String b, int[][] d) {
    List<EditOperation> result = new ArrayList<>();
    for (int i = a.length(), j = b.length(); i > 0 || j > 0;) {
      if (i > 0 && j > 0 && a.charAt(i - 1) == b.charAt(j - 1) && d[i][j] == d[i - 1][j - 1]) { result.add(new EditOperation("MATCH", "" + a.charAt(i - 1), "" + b.charAt(j - 1), i, j, 0)); i--; j--; }
      else if (i > 0 && j > 0 && d[i][j] == d[i - 1][j - 1] + 1) { result.add(new EditOperation("SUBSTITUTE", "" + a.charAt(i - 1), "" + b.charAt(j - 1), i, j, 1)); i--; j--; }
      else if (i > 0 && d[i][j] == d[i - 1][j] + 1) { result.add(new EditOperation("DELETE", "" + a.charAt(i - 1), "-", i, null, 1)); i--; }
      else { result.add(new EditOperation("INSERT", "-", "" + b.charAt(j - 1), null, j, 1)); j--; }
    }
    Collections.reverse(result); return result;
  }
  private int[][] buildLcsTable(String a, String b, List<TraceEvent> trace) {
    int[][] table = new int[a.length() + 1][b.length() + 1];
    for (int i = 0; i <= a.length(); i++) for (int j = 0; j <= b.length(); j++) {
      boolean base = i == 0 || j == 0, match = !base && a.charAt(i - 1) == b.charAt(j - 1);
      if (!base) table[i][j] = match ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
      if (trace != null) trace.add(cellEvent(trace.size() + 1, "LCS_TABULATION", i, j, a, b, table, base, match));
    }
    return table;
  }
  private int[][] buildEditTable(String a, String b, List<TraceEvent> trace) {
    int[][] table = new int[a.length() + 1][b.length() + 1];
    for (int i = 0; i <= a.length(); i++) for (int j = 0; j <= b.length(); j++) {
      boolean base = i == 0 || j == 0, match = !base && a.charAt(i - 1) == b.charAt(j - 1);
      if (base) table[i][j] = i == 0 ? j : i;
      else table[i][j] = match ? table[i - 1][j - 1] : 1 + Math.min(Math.min(table[i - 1][j], table[i][j - 1]), table[i - 1][j - 1]);
      if (trace != null) trace.add(cellEvent(trace.size() + 1, "EDIT_DISTANCE_TABULATION", i, j, a, b, table, base, match));
    }
    return table;
  }
  private TraceEvent cellEvent(int step, String algorithm, int i, int j, String a, String b, int[][] table, boolean base, boolean match) {
    String ca = i == 0 ? "-" : "" + a.charAt(i - 1), cb = j == 0 ? "-" : "" + b.charAt(j - 1);
    boolean lcs = algorithm.startsWith("LCS"); String rule = base ? "BASE_CASE" : lcs ? (match ? "MATCH_DIAGONAL" : "MAX_UP_LEFT") : (match ? "MATCH_DIAGONAL" : "MIN_EDIT");
    String explanation;
    if (base) explanation = lcs ? "Base case L[" + i + "][" + j + "] = 0." : "Base case D[" + i + "][" + j + "] = " + table[i][j] + ".";
    else if (lcs && match) explanation = "A[" + i + "] = " + ca + " matches B[" + j + "] = " + cb + "; 1 + diagonal " + table[i - 1][j - 1] + " = " + table[i][j] + ".";
    else if (lcs) explanation = "A[" + i + "] = " + ca + " differs from B[" + j + "] = " + cb + "; max(upper " + table[i - 1][j] + ", left " + table[i][j - 1] + ") = " + table[i][j] + ".";
    else if (match) explanation = "A[" + i + "] = " + ca + " matches B[" + j + "] = " + cb + "; carry diagonal value " + table[i - 1][j - 1] + ".";
    else { int deletion = table[i - 1][j] + 1, insertion = table[i][j - 1] + 1, substitution = table[i - 1][j - 1] + 1; explanation = "A[" + i + "] = " + ca + " differs from B[" + j + "] = " + cb + "; min(delete " + deletion + ", insert " + insertion + ", substitute " + substitution + ") = " + table[i][j] + "."; }
    List<int[]> predecessors = new ArrayList<>(); if (!base && lcs && match) predecessors.add(new int[]{i - 1, j - 1}); else { if (i > 0) predecessors.add(new int[]{i - 1, j}); if (j > 0) predecessors.add(new int[]{i, j - 1}); if (i > 0 && j > 0) predecessors.add(new int[]{i - 1, j - 1}); }
    return new TraceEvent(step, algorithm, "CELL_COMPUTED", i, j, ca, cb, predecessors, table[i][j], rule, explanation);
  }
  private double lcsSimilarity(int value, int m, int n) { return m + n == 0 ? 100 : round(200.0 * value / (m + n)); }
  private double editSimilarity(int value, int m, int n) { return Math.max(m, n) == 0 ? 100 : round(100.0 * (1 - (double) value / Math.max(m, n))); }
  private double round(double value) { return Math.round(value * 100.0) / 100.0; }
}
