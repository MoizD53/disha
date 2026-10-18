package com.disha.locationtracker.data.local

import android.content.Context
import android.content.SharedPreferences
import com.disha.locationtracker.config.ServerConfig

class AppPreferences(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("disha_tracker_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, ServerConfig.DEFAULT_SERVER_URL) ?: ServerConfig.DEFAULT_SERVER_URL
        set(value) {
            val sanitized = ServerConfig.sanitizeUrl(value)
            prefs.edit().putString(KEY_SERVER_URL, sanitized).apply()
        }

    var bearerToken: String?
        get() = prefs.getString(KEY_BEARER_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_BEARER_TOKEN, value).apply()

    var sessionCookie: String?
        get() = prefs.getString(KEY_SESSION_COOKIE, null)
        set(value) = prefs.edit().putString(KEY_SESSION_COOKIE, value).apply()

    var username: String?
        get() = prefs.getString(KEY_USERNAME, null)
        set(value) = prefs.edit().putString(KEY_USERNAME, value).apply()

    var personnelId: String?
        get() = prefs.getString(KEY_PERSONNEL_ID, null)
        set(value) = prefs.edit().putString(KEY_PERSONNEL_ID, value).apply()

    var personnelName: String?
        get() = prefs.getString(KEY_PERSONNEL_NAME, null)
        set(value) = prefs.edit().putString(KEY_PERSONNEL_NAME, value).apply()

    var deviceIdentifier: String
        get() = prefs.getString(KEY_DEVICE_IDENTIFIER, "") ?: ""
        set(value) = prefs.edit().putString(KEY_DEVICE_IDENTIFIER, value).apply()

    var dutySessionId: String?
        get() = prefs.getString(KEY_DUTY_SESSION_ID, null)
        set(value) = prefs.edit().putString(KEY_DUTY_SESSION_ID, value).apply()

    var dutyStatus: String
        get() = prefs.getString(KEY_DUTY_STATUS, "OFF_DUTY") ?: "OFF_DUTY"
        set(value) = prefs.edit().putString(KEY_DUTY_STATUS, value).apply()

    var isSosActive: Boolean
        get() = prefs.getBoolean(KEY_IS_SOS_ACTIVE, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_SOS_ACTIVE, value).apply()

    var consentGivenAt: Long
        get() = prefs.getLong(KEY_CONSENT_TIMESTAMP, 0L)
        set(value) = prefs.edit().putLong(KEY_CONSENT_TIMESTAMP, value).apply()

    val isLoggedIn: Boolean
        get() = !bearerToken.isNullOrBlank() && !personnelId.isNullOrBlank()

    /**
     * In continuous 24/7 tracking mode, tracking is active whenever authenticated.
     */
    val isTrackingEnabled: Boolean
        get() = isLoggedIn

    val isOnDuty: Boolean
        get() = isLoggedIn

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_BEARER_TOKEN)
            .remove(KEY_SESSION_COOKIE)
            .remove(KEY_PERSONNEL_ID)
            .remove(KEY_PERSONNEL_NAME)
            .remove(KEY_DUTY_SESSION_ID)
            .remove(KEY_DUTY_STATUS)
            .putBoolean(KEY_IS_SOS_ACTIVE, false)
            .apply()
    }

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_BEARER_TOKEN = "bearer_token"
        private const val KEY_SESSION_COOKIE = "session_cookie"
        private const val KEY_USERNAME = "username"
        private const val KEY_PERSONNEL_ID = "personnel_id"
        private const val KEY_PERSONNEL_NAME = "personnel_name"
        private const val KEY_DEVICE_IDENTIFIER = "device_identifier"
        private const val KEY_DUTY_SESSION_ID = "duty_session_id"
        private const val KEY_DUTY_STATUS = "duty_status"
        private const val KEY_IS_SOS_ACTIVE = "is_sos_active"
        private const val KEY_CONSENT_TIMESTAMP = "consent_timestamp"
    }
}
