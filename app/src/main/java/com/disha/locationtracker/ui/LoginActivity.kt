package com.disha.locationtracker.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.disha.locationtracker.DishaApplication
import com.disha.locationtracker.config.ServerConfig
import com.disha.locationtracker.data.model.EnrollRequest
import com.disha.locationtracker.data.model.LoginRequest
import com.disha.locationtracker.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.UUID

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val prefs by lazy { DishaApplication.instance.prefs }
    private val apiClient by lazy { DishaApplication.instance.apiClient }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ensure server URL uses centralized production configuration
        if (prefs.serverUrl.isBlank() ||
            prefs.serverUrl.contains("192.168.") ||
            prefs.serverUrl.contains("10.0.2.2") ||
            prefs.serverUrl.contains("localhost") ||
            prefs.serverUrl.contains("disha-livid-beta.vercel.app") ||
            prefs.serverUrl.contains("disha-duokarma1.vercel.app")
        ) {
            prefs.serverUrl = ServerConfig.DEFAULT_SERVER_URL
        }

        if (prefs.isLoggedIn) {
            navigateToMain()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupDeviceIdentifier()
        setupListeners()
    }

    @SuppressLint("HardwareIds")
    private fun setupDeviceIdentifier() {
        var deviceId = prefs.deviceIdentifier

        if (deviceId.isBlank()) {
            val androidId = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ANDROID_ID
            )

            deviceId = if (!androidId.isNullOrBlank() &&
                androidId != "9774d56d682e549c"
            ) {
                "android-$androidId"
            } else {
                "android-${UUID.randomUUID().toString().take(12)}"
            }

            prefs.deviceIdentifier = deviceId
        }
    }

    private fun setupListeners() {
        binding.loginButton.setOnClickListener {
            attemptLogin()
        }

        // Long press on DISHA logo/title allows easy backend IP configuration
        binding.logoImage.setOnLongClickListener {
            showServerConfigDialog()
            true
        }

        binding.titleText.setOnLongClickListener {
            showServerConfigDialog()
            true
        }
    }

    private fun showServerConfigDialog() {
        val input = EditText(this).apply {
            setText(prefs.serverUrl)
            hint = ServerConfig.DEFAULT_SERVER_URL
            setSelection(text.length)
            setPadding(48, 24, 48, 24)
        }

        AlertDialog.Builder(this)
            .setTitle("DISHA Server Configuration")
            .setMessage("Set the backend control room address (e.g. PC LAN IP):")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotBlank()) {
                    prefs.serverUrl = newUrl
                    Toast.makeText(this, "Server URL updated:\n${prefs.serverUrl}", Toast.LENGTH_SHORT).show()
                }
            }
            .setNeutralButton("Reset Default") { _, _ ->
                prefs.serverUrl = ServerConfig.DEFAULT_SERVER_URL
                Toast.makeText(this, "Reset to: ${ServerConfig.DEFAULT_SERVER_URL}", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun attemptLogin() {
        val username = binding.usernameInput.text?.toString()?.trim().orEmpty()
        val password = binding.passwordInput.text?.toString()?.trim().orEmpty()
        val deviceId = prefs.deviceIdentifier

        if (username.isBlank()) {
            binding.usernameLayout.error = "Username is required"
            return
        } else {
            binding.usernameLayout.error = null
        }

        if (password.isBlank()) {
            binding.passwordLayout.error = "Password is required"
            return
        } else {
            binding.passwordLayout.error = null
        }

        setLoadingState(true)

        lifecycleScope.launch {
            try {
                val enrollResult = apiClient.enrollDevice(
                    EnrollRequest(
                        username = username,
                        password = password,
                        deviceIdentifier = deviceId,
                        platform = "Android",
                        appVersion = "1.0.0"
                    )
                )

                if (enrollResult.isSuccess) {
                    val data = enrollResult.getOrNull()
                    val token = data?.token
                    val personnel = data?.personnel

                    if (!token.isNullOrBlank() && personnel != null) {
                        prefs.bearerToken = token
                        prefs.personnelId = personnel.id
                        prefs.personnelName = personnel.name
                        prefs.username = username

                        apiClient.login(
                            LoginRequest(
                                username = username,
                                password = password
                            )
                        )

                        setLoadingState(false)
                        navigateToMain()
                        return@launch
                    }
                }

                val loginResult = apiClient.login(
                    LoginRequest(
                        username = username,
                        password = password
                    )
                )

                if (loginResult.isSuccess) {
                    val retryEnroll = apiClient.enrollDevice(
                        EnrollRequest(
                            username = username,
                            password = password,
                            deviceIdentifier = deviceId,
                            platform = "Android",
                            appVersion = "1.0.0"
                        )
                    )

                    val data = retryEnroll.getOrNull()

                    if (retryEnroll.isSuccess && !data?.token.isNullOrBlank()) {
                        prefs.bearerToken = data!!.token
                        prefs.personnelId = data.personnel?.id
                        prefs.personnelName = data.personnel?.name
                        prefs.username = username

                        setLoadingState(false)
                        navigateToMain()
                        return@launch
                    }
                }

                val errorException = enrollResult.exceptionOrNull() ?: loginResult.exceptionOrNull()
                showUserFriendlyError(errorException)
            } catch (e: Exception) {
                showUserFriendlyError(e)
            } finally {
                setLoadingState(false)
            }
        }
    }

    private fun showUserFriendlyError(throwable: Throwable?) {
        val message = when {
            throwable is ConnectException || throwable?.cause is ConnectException ->
                "Cannot reach server at ${prefs.serverUrl}. Ensure the server is running and both devices are on the same Wi-Fi."
            throwable is SocketTimeoutException || throwable?.cause is SocketTimeoutException ->
                "Connection timed out. Check network access to ${prefs.serverUrl}."
            throwable is UnknownHostException ->
                "Server host not found: ${prefs.serverUrl}."
            throwable?.message?.contains("401") == true ->
                "Invalid username or password. Please verify your credentials."
            throwable?.message?.contains("403") == true ->
                "Account not authorized for field tracking."
            throwable?.message?.contains("500") == true ->
                "DISHA server encountered an internal error. Please try again."
            else ->
                throwable?.message ?: "Sign in failed. Check credentials and server connection."
        }
        showError(message)
    }

    private fun setLoadingState(loading: Boolean) {
        binding.loginProgressBar.visibility =
            if (loading) View.VISIBLE else View.GONE

        binding.loginButton.isEnabled = !loading
        binding.usernameInput.isEnabled = !loading
        binding.passwordInput.isEnabled = !loading

        if (loading) {
            binding.errorText.visibility = View.GONE
        }
    }

    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
