package com.disha.locationtracker.calculator

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import java.util.Stack

/**
 * CalculatorEngine handles arithmetic evaluation with standard operator precedence (* and / before + and -),
 * input validation, decimal handling, and the secret code trigger check.
 */
class CalculatorEngine {

    var expression: String = ""
        private set

    var display: String = "0"
        private set

    var lastEvaluatedExpression: String? = null
        private set

    var lastEvaluatedResult: String? = null
        private set

    var isEvaluated: Boolean = false
        private set

    private val decimalFormat = DecimalFormat("0.########", DecimalFormatSymbols(Locale.US))

    fun inputDigit(digit: Char) {
        if (!digit.isDigit()) return

        if (isEvaluated) {
            expression = ""
            display = ""
            isEvaluated = false
        }

        if (display == "0" || display == "Cannot divide by 0" || display == "Error") {
            display = digit.toString()
        } else {
            display += digit
        }
        expression += digit
    }

    fun inputDecimal() {
        if (isEvaluated) {
            expression = "0."
            display = "0."
            isEvaluated = false
            return
        }

        if (display == "Cannot divide by 0" || display == "Error") {
            expression = "0."
            display = "0."
            return
        }

        // Check if current operand already has a decimal
        val lastNumber = getCurrentOperand()
        if (lastNumber.contains(".")) {
            return
        }

        if (lastNumber.isEmpty()) {
            display += "0."
            expression += "0."
        } else {
            display += "."
            expression += "."
        }
    }

    fun inputOperator(opSymbol: Char) {
        val standardOp = when (opSymbol) {
            '+' -> "+"
            '-', '−' -> "−"
            '*', '×' -> "×"
            '/', '÷' -> "÷"
            else -> return
        }

        if (display == "Cannot divide by 0" || display == "Error") {
            return
        }

        if (isEvaluated) {
            // Chain calculation starting from previous result
            expression = display
            isEvaluated = false
        }

        if (expression.isEmpty()) {
            if (standardOp == "−") {
                expression = "−"
                display = "−"
            }
            return
        }

        val trimmed = expression.trimEnd()
        if (trimmed.endsWith("+") || trimmed.endsWith("−") || trimmed.endsWith("×") || trimmed.endsWith("÷")) {
            // Replace the previous trailing operator
            expression = trimmed.substring(0, trimmed.length - 1).trimEnd() + " $standardOp "
        } else {
            expression = "$trimmed $standardOp "
        }
        display = standardOp
    }

    fun delete() {
        if (isEvaluated) {
            clear()
            return
        }

        if (expression.isNotEmpty()) {
            val trimmed = expression.trimEnd()
            if (trimmed.endsWith("+") || trimmed.endsWith("−") || trimmed.endsWith("×") || trimmed.endsWith("÷")) {
                expression = trimmed.substring(0, trimmed.length - 1).trimEnd()
            } else {
                expression = expression.substring(0, expression.length - 1)
            }
            val currentOp = getCurrentOperand()
            display = if (currentOp.isNotEmpty()) currentOp else "0"
        } else {
            display = "0"
        }
    }

    fun clear() {
        expression = ""
        display = "0"
        lastEvaluatedExpression = null
        lastEvaluatedResult = null
        isEvaluated = false
    }

    fun evaluate(): EvaluationResult {
        if (expression.isBlank()) {
            return EvaluationResult(display = display, isSecretCode = false, isError = false)
        }

        val normalized = normalizeExpression(expression)

        try {
            val resultValue = evaluateExpression(normalized)
            if (resultValue.isInfinite() || resultValue.isNaN()) {
                display = "Cannot divide by 0"
                isEvaluated = true
                return EvaluationResult(display = display, isSecretCode = false, isError = true)
            }

            val formatted = formatResult(resultValue)
            lastEvaluatedExpression = expression
            lastEvaluatedResult = formatted
            display = formatted
            isEvaluated = true

            val isSecret = checkSecretCode(normalized, formatted)
            return EvaluationResult(display = display, isSecretCode = isSecret, isError = false)
        } catch (e: ArithmeticException) {
            display = "Cannot divide by 0"
            isEvaluated = true
            return EvaluationResult(display = display, isSecretCode = false, isError = true)
        } catch (e: Exception) {
            display = "Error"
            isEvaluated = true
            return EvaluationResult(display = display, isSecretCode = false, isError = true)
        }
    }

    private fun normalizeExpression(expr: String): String {
        return expr
            .replace('×', '*')
            .replace('÷', '/')
            .replace('−', '-')
            .replace('\u2212', '-')
            .replace('\u2013', '-')
            .replace('\u2014', '-')
            .trim()
    }

    /**
     * Secret Code Condition:
     * User explicitly evaluated `110 + 786` and the evaluated result is `896`.
     * Handles harmless formatting (spaces, etc.).
     */
    private fun checkSecretCode(normalizedExpr: String, resultString: String): Boolean {
        if (resultString != "896") return false

        // Strip all whitespace
        val clean = normalizedExpr.replace("\\s+".toRegex(), "")

        // Must match 110+786 (or with harmless .0 decimal places)
        val validSecretPatterns = listOf(
            "110+786",
            "110.0+786",
            "110+786.0",
            "110.0+786.0"
        )
        return clean in validSecretPatterns
    }

    private fun getCurrentOperand(): String {
        val parts = expression.split(" ", "+", "−", "×", "÷", "-", "*", "/")
        return parts.lastOrNull()?.trim().orEmpty()
    }

    private fun formatResult(value: Double): String {
        return if (value == value.toLong().toDouble()) {
            value.toLong().toString()
        } else {
            decimalFormat.format(value)
        }
    }

    /**
     * Evaluates arithmetic expressions with standard operator precedence:
     * * and / are evaluated before + and -
     */
    private fun evaluateExpression(expr: String): Double {
        val tokens = tokenize(expr)
        if (tokens.isEmpty()) return 0.0

        val values = Stack<Double>()
        val ops = Stack<Char>()

        var i = 0
        while (i < tokens.size) {
            val token = tokens[i]
            when {
                token.length == 1 && isOperator(token[0]) -> {
                    val op = token[0]
                    while (ops.isNotEmpty() && precedence(ops.peek()) >= precedence(op)) {
                        val val2 = values.pop()
                        val val1 = values.pop()
                        values.push(applyOp(ops.pop(), val1, val2))
                    }
                    ops.push(op)
                }
                else -> {
                    values.push(token.toDouble())
                }
            }
            i++
        }

        while (ops.isNotEmpty()) {
            val val2 = values.pop()
            val val1 = values.pop()
            values.push(applyOp(ops.pop(), val1, val2))
        }

        return if (values.isNotEmpty()) values.pop() else 0.0
    }

    private fun tokenize(expr: String): List<String> {
        val tokens = mutableListOf<String>()
        val sb = StringBuilder()
        var i = 0

        while (i < expr.length) {
            val c = expr[i]
            if (c.isWhitespace()) {
                if (sb.isNotEmpty()) {
                    tokens.add(sb.toString())
                    sb.clear()
                }
                i++
                continue
            }

            if (isOperator(c)) {
                // Check if this is a unary negative sign
                val isUnaryMinus = c == '-' && (tokens.isEmpty() || isOperator(tokens.last().singleOrNull() ?: ' ')) && sb.isEmpty()
                if (isUnaryMinus) {
                    sb.append(c)
                } else {
                    if (sb.isNotEmpty()) {
                        tokens.add(sb.toString())
                        sb.clear()
                    }
                    tokens.add(c.toString())
                }
            } else {
                sb.append(c)
            }
            i++
        }

        if (sb.isNotEmpty()) {
            tokens.add(sb.toString())
        }
        return tokens
    }

    private fun isOperator(c: Char): Boolean = c == '+' || c == '-' || c == '*' || c == '/'

    private fun precedence(op: Char): Int = when (op) {
        '*', '/' -> 2
        '+', '-' -> 1
        else -> 0
    }

    private fun applyOp(op: Char, a: Double, b: Double): Double {
        return when (op) {
            '+' -> a + b
            '-' -> a - b
            '*' -> a * b
            '/' -> {
                if (b == 0.0) throw ArithmeticException("Division by zero")
                a / b
            }
            else -> 0.0
        }
    }

    data class EvaluationResult(
        val display: String,
        val isSecretCode: Boolean,
        val isError: Boolean
    )
}
