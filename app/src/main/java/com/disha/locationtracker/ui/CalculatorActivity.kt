package com.disha.locationtracker.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.disha.locationtracker.DishaApplication
import com.disha.locationtracker.calculator.CalculatorEngine
import com.disha.locationtracker.databinding.ActivityCalculatorBinding

class CalculatorActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCalculatorBinding
    private val engine = CalculatorEngine()
    private val prefs by lazy { DishaApplication.instance.prefs }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCalculatorBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupKeypad()
        setupAccessiblePortalRoutes()
        updateDisplay()
    }

    override fun onResume() {
        super.onResume()
        // If the officer is logged in, ensure background service is actively running
        if (prefs.isLoggedIn) {
            com.disha.locationtracker.service.LocationTrackingService.start(this)
        }
    }

    private fun setupKeypad() {
        // Digits
        binding.btn0.setOnClickListener { onDigit('0') }
        binding.btn1.setOnClickListener { onDigit('1') }
        binding.btn2.setOnClickListener { onDigit('2') }
        binding.btn3.setOnClickListener { onDigit('3') }
        binding.btn4.setOnClickListener { onDigit('4') }
        binding.btn5.setOnClickListener { onDigit('5') }
        binding.btn6.setOnClickListener { onDigit('6') }
        binding.btn7.setOnClickListener { onDigit('7') }
        binding.btn8.setOnClickListener { onDigit('8') }
        binding.btn9.setOnClickListener { onDigit('9') }

        // Decimal
        binding.btnDot.setOnClickListener {
            engine.inputDecimal()
            updateDisplay()
        }

        // Operators
        binding.btnAdd.setOnClickListener { onOperator('+') }
        binding.btnSub.setOnClickListener { onOperator('−') }
        binding.btnMul.setOnClickListener { onOperator('×') }
        binding.btnDiv.setOnClickListener { onOperator('÷') }

        // Actions
        binding.btnAc.setOnClickListener {
            engine.clear()
            updateDisplay()
        }

        binding.btnDel.setOnClickListener {
            engine.delete()
            updateDisplay()
        }

        binding.btnPercent.setOnClickListener {
            // Evaluates current and divides by 100
            val res = engine.evaluate()
            if (!res.isError && res.display.toDoubleOrNull() != null) {
                val pct = res.display.toDouble() / 100.0
                engine.clear()
                val str = if (pct == pct.toLong().toDouble()) pct.toLong().toString() else pct.toString()
                for (c in str) {
                    if (c == '.') engine.inputDecimal() else if (c.isDigit()) engine.inputDigit(c)
                }
            }
            updateDisplay()
        }

        binding.btnPlusMinus.setOnClickListener {
            // Toggles operator or negation
            onOperator('−')
        }

        // Equals / Evaluate (Checks Secret Code Trigger)
        binding.btnEquals.setOnClickListener {
            val result = engine.evaluate()
            updateDisplay()

            if (result.isSecretCode) {
                // Secret access sequence: 110 + 786 = 896
                handleSecretAccessTrigger()
            }
        }
    }

    private fun onDigit(digit: Char) {
        engine.inputDigit(digit)
        updateDisplay()
    }

    private fun onOperator(op: Char) {
        engine.inputOperator(op)
        updateDisplay()
    }

    private fun updateDisplay() {
        binding.expressionText.text = engine.expression
        binding.resultText.text = engine.display
    }

    /**
     * Secret access sequence: smoothly transitions to the existing DISHA authentication screen.
     */
    private fun handleSecretAccessTrigger() {
        // Slight delay so the user sees the evaluated '896' result on the calculator display
        Handler(Looper.getMainLooper()).postDelayed({
            transitionToAuthScreen()
        }, 350)
    }

    /**
     * Fallback / direct accessible route for developers, administrators, and field officers
     * so secret code is a convenience, not the only access method.
     */
    private fun setupAccessiblePortalRoutes() {
        // 1. Direct button in top bar
        binding.btnOfficerPortal.setOnClickListener {
            showOfficerAccessDialog()
        }

        // 2. Long-press on display area as alternate dev shortcut
        binding.displayContainer.setOnLongClickListener {
            showOfficerAccessDialog()
            true
        }

        binding.calcHeaderTitle.setOnLongClickListener {
            showOfficerAccessDialog()
            true
        }
    }

    private fun showOfficerAccessDialog() {
        AlertDialog.Builder(this)
            .setTitle("DISHA Officer Portal")
            .setMessage("Open the DISHA field personnel login and device enrollment screen?")
            .setPositiveButton("Open Login") { _, _ ->
                transitionToAuthScreen()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun transitionToAuthScreen() {
        val targetActivity = if (prefs.isLoggedIn) {
            MainActivity::class.java
        } else {
            LoginActivity::class.java
        }

        val intent = Intent(this, targetActivity).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            overrideActivityTransition(
                OVERRIDE_TRANSITION_OPEN,
                android.R.anim.fade_in,
                android.R.anim.fade_out
            )
        } else {
            @Suppress("DEPRECATION")
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }
    }
}
