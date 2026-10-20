package com.disha.locationtracker.config

object ServerConfig {
    /**
     * Centralized default backend URL for DISHA control room server.
     * Production live server: https://disha-roan.vercel.app
     */
    const val DEFAULT_SERVER_URL = "https://disha-roan.vercel.app"

    fun sanitizeUrl(url: String): String {
        val trimmed = url.trim()
        val withScheme = if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            "https://$trimmed"
        } else {
            trimmed
        }
        return if (withScheme.endsWith("/")) withScheme.dropLast(1) else withScheme
    }
}
