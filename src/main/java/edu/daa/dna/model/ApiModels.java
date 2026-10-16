package edu.daa.dna.model;

import jakarta.validation.constraints.NotNull;
import java.util.*;

public final class ApiModels {
  private ApiModels() {}
  public record AnalyzeRequest(@NotNull String sequenceA, @NotNull String sequenceB, boolean includeTrace, boolean includeTables, String lcsVariant, String editVariant) {
    public AnalyzeRequest(String sequenceA, String sequenceB, boolean includeTrace, boolean includeTables) { this(sequenceA, sequenceB, includeTrace, includeTables, "TABULATION", "TABULATION"); }
  }
  public record Position(int indexA, int indexB, String nucleotide) {}
  public record EditOperation(String type, String characterA, String characterB, Integer positionA, Integer positionB, int cost) {}
  public record TraceEvent(int step, String algorithm, String eventType, int row, int column, String characterA, String characterB, List<int[]> predecessors, int value, String rule, String explanation) {}
  public record AlgorithmInfo(String name, String timeComplexity, String spaceComplexity) {}
  public record AnalysisResponse(String sequenceA, String sequenceB, int lengthA, int lengthB, String lcs, int lcsLength, List<Position> matches, double lcsSimilarity, int editDistance, double editSimilarity, List<EditOperation> editOperations, String lcsAlgorithm, String editAlgorithm, List<AlgorithmInfo> algorithms, int[][] lcsTable, int[][] editTable, List<TraceEvent> trace, boolean traceAvailable) {}
  public record BenchmarkRequest(String problem, List<String> algorithms, Integer size, Integer repetitions, Long seed, String pattern) {}
  public record BenchmarkResult(String algorithm, String problem, int lengthA, int lengthB, long medianNanoseconds, double medianMilliseconds, String timeComplexity, String spaceComplexity, boolean correct) {}
  public record BenchmarkResponse(long seed, int repetitions, String pattern, List<BenchmarkResult> results) {}
  public record FastaRecord(String header, String sequence) {}
}
