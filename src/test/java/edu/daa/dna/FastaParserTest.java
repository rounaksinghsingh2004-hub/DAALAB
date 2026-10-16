package edu.daa.dna;

import edu.daa.dna.parser.FastaParser;
import edu.daa.dna.validation.SequenceValidator;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FastaParserTest {
  private final FastaParser parser = new FastaParser(new SequenceValidator());

  @Test
  void rejectsMissingOrBlankContent() {
    assertThrows(IllegalArgumentException.class, () -> parser.parse(null));
    assertThrows(IllegalArgumentException.class, () -> parser.parse("  \n\t "));
  }

  @Test
  void parsesMultilineRecordsAndNormalizesSequences() {
    var records = parser.parse(">first\nac\nGT\n>second\nA\nT\n");
    assertEquals(2, records.size());
    assertEquals("ACGT", records.get(0).sequence());
    assertEquals("AT", records.get(1).sequence());
  }
}
