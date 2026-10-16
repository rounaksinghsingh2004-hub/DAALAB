package edu.daa.dna;
import edu.daa.dna.algorithm.DynamicProgramming;import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;
class DynamicProgrammingTest {@Test void variantsAgree(){String a="ACGTCG",b="ACTCG";assertEquals(5,DynamicProgramming.lcsMemo(a,b));assertEquals(5,DynamicProgramming.lcsRolling(a,b));assertEquals(1,DynamicProgramming.editMemo(a,b));assertEquals(1,DynamicProgramming.editRolling(a,b));}@Test void emptyInputs(){assertEquals(0,DynamicProgramming.lcsRolling("","AC"));assertEquals(2,DynamicProgramming.editRolling("","AC"));}}
