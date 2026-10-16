package edu.daa.dna.parser;

import edu.daa.dna.model.ApiModels.FastaRecord;
import edu.daa.dna.validation.SequenceValidator;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class FastaParser {
  private final SequenceValidator validator;
  public FastaParser(SequenceValidator validator) { this.validator = validator; }
  public List<FastaRecord> parse(String text) {
    if (text == null || text.isBlank()) throw new IllegalArgumentException("FASTA content is required.");
    List<FastaRecord> records = new ArrayList<>(); String header = null; StringBuilder sequence = new StringBuilder();
    for (String line : text.replace("\r", "").split("\n")) {
      if (line.startsWith(">")) { if (header != null) records.add(new FastaRecord(header, validator.normalize(sequence.toString()))); header=line.substring(1).trim(); sequence.setLength(0); }
      else if (!line.isBlank()) { if (header == null) throw new IllegalArgumentException("FASTA must begin with a > header."); sequence.append(line); }
    }
    if (header != null) records.add(new FastaRecord(header, validator.normalize(sequence.toString())));
    if (records.isEmpty()) throw new IllegalArgumentException("No FASTA records were found."); return records;
  }
}
