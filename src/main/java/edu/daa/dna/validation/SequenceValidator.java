package edu.daa.dna.validation;

import org.springframework.stereotype.Component;

@Component
public class SequenceValidator {
  private static final String ALPHABET = "ACGTRYSWKMBDHVN";
  public String normalize(String input) {
    if (input == null) throw new IllegalArgumentException("A DNA sequence is required.");
    String sequence = input.replaceAll("\\s+", "").toUpperCase();
    if (sequence.length() > 2000) throw new IllegalArgumentException("Sequences are limited to 2,000 nucleotides.");
    for (int i = 0; i < sequence.length(); i++) if (ALPHABET.indexOf(sequence.charAt(i)) < 0)
      throw new IllegalArgumentException("Unsupported symbol '" + sequence.charAt(i) + "' at position " + (i + 1) + ". Use DNA IUPAC symbols only.");
    return sequence;
  }
}
