package com.disha.locationtracker

import com.disha.locationtracker.calculator.CalculatorEngine
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class CalculatorEngineTest {

    private lateinit var engine: CalculatorEngine

    @Before
    fun setUp() {
        engine = CalculatorEngine()
    }

    @Test
    fun testBasicAddition() {
        engine.inputDigit('1')
        engine.inputDigit('2')
        engine.inputOperator('+')
        engine.inputDigit('3')
        engine.inputDigit('4')
        val res = engine.evaluate()
        assertEquals("46", res.display)
        assertFalse(res.isSecretCode)
        assertFalse(res.isError)
    }

    @Test
    fun testBasicSubtraction() {
        engine.inputDigit('5')
        engine.inputDigit('0')
        engine.inputOperator('−')
        engine.inputDigit('1')
        engine.inputDigit('5')
        val res = engine.evaluate()
        assertEquals("35", res.display)
        assertFalse(res.isSecretCode)
    }

    @Test
    fun testMultiplicationAndPrecedence() {
        // 10 + 5 * 2 = 20 (not 30)
        engine.inputDigit('1')
        engine.inputDigit('0')
        engine.inputOperator('+')
        engine.inputDigit('5')
        engine.inputOperator('×')
        engine.inputDigit('2')
        val res = engine.evaluate()
        assertEquals("20", res.display)
        assertFalse(res.isSecretCode)
    }

    @Test
    fun testDivisionAndPrecedence() {
        // 100 - 50 / 2 = 75 (not 25)
        engine.inputDigit('1')
        engine.inputDigit('0')
        engine.inputDigit('0')
        engine.inputOperator('−')
        engine.inputDigit('5')
        engine.inputDigit('0')
        engine.inputOperator('÷')
        engine.inputDigit('2')
        val res = engine.evaluate()
        assertEquals("75", res.display)
        assertFalse(res.isSecretCode)
    }

    @Test
    fun testDivisionByZero() {
        engine.inputDigit('9')
        engine.inputOperator('÷')
        engine.inputDigit('0')
        val res = engine.evaluate()
        assertEquals("Cannot divide by 0", res.display)
        assertTrue(res.isError)
        assertFalse(res.isSecretCode)
    }

    @Test
    fun testDecimalOperations() {
        engine.inputDigit('3')
        engine.inputDecimal()
        engine.inputDigit('5')
        engine.inputOperator('+')
        engine.inputDigit('4')
        engine.inputDecimal()
        engine.inputDigit('5')
        val res = engine.evaluate()
        assertEquals("8", res.display)
    }

    @Test
    fun testPreventMultipleDecimalsInOperand() {
        engine.inputDigit('1')
        engine.inputDecimal()
        engine.inputDigit('2')
        engine.inputDecimal() // Should be ignored
        engine.inputDigit('3')
        assertEquals("1.23", engine.display)
    }

    @Test
    fun testClear() {
        engine.inputDigit('9')
        engine.inputDigit('9')
        engine.inputOperator('+')
        engine.inputDigit('1')
        engine.clear()
        assertEquals("0", engine.display)
        assertEquals("", engine.expression)
    }

    @Test
    fun testDelete() {
        engine.inputDigit('1')
        engine.inputDigit('2')
        engine.inputDigit('3')
        engine.delete()
        assertEquals("12", engine.display)
    }

    @Test
    fun testSecretCode_TriggeredOnExactEvaluation() {
        // Evaluate 110 + 786 -> 896
        engine.inputDigit('1')
        engine.inputDigit('1')
        engine.inputDigit('0')
        engine.inputOperator('+')
        engine.inputDigit('7')
        engine.inputDigit('8')
        engine.inputDigit('6')

        // Before pressing evaluate, secret code must NOT be triggered
        assertFalse(engine.isEvaluated)

        val res = engine.evaluate()
        assertEquals("896", res.display)
        assertTrue("Secret code MUST be triggered when evaluating 110 + 786 = 896", res.isSecretCode)
        assertFalse(res.isError)
    }

    @Test
    fun testSecretCode_NotTriggeredByMerelyTyping896() {
        engine.inputDigit('8')
        engine.inputDigit('9')
        engine.inputDigit('6')

        // Before evaluation
        assertFalse(engine.isEvaluated)

        // Evaluate plain 896 without expression
        val res = engine.evaluate()
        assertEquals("896", res.display)
        assertFalse("Merely typing 896 must NOT trigger secret code", res.isSecretCode)
    }

    @Test
    fun testSecretCode_NotTriggeredByOtherExpressionEqualing896() {
        // 800 + 96 = 896
        engine.inputDigit('8')
        engine.inputDigit('0')
        engine.inputDigit('0')
        engine.inputOperator('+')
        engine.inputDigit('9')
        engine.inputDigit('6')

        val res = engine.evaluate()
        assertEquals("896", res.display)
        assertFalse("Other calculations equaling 896 must NOT trigger secret code", res.isSecretCode)
    }

    @Test
    fun testSecretCode_NotTriggeredByDifferentResult() {
        // 110 + 785 = 895
        engine.inputDigit('1')
        engine.inputDigit('1')
        engine.inputDigit('0')
        engine.inputOperator('+')
        engine.inputDigit('7')
        engine.inputDigit('8')
        engine.inputDigit('5')

        val res = engine.evaluate()
        assertEquals("895", res.display)
        assertFalse("Expressions not equaling 896 must NOT trigger secret code", res.isSecretCode)
    }
}
