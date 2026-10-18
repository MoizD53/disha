package com.disha.locationtracker.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.disha.locationtracker.DishaApplication
import com.disha.locationtracker.R
import com.disha.locationtracker.ui.MainActivity
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class LocationTrackingService : Service(), LocationListener {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var wakeLock: PowerManager.WakeLock? = null
    private var locationManager: LocationManager? = null

    private var heartbeatJob: Job? = null
    private var lastLocation: Location? = null

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager

        acquireWakeLock()
        startInForeground()
        startLocationUpdates()
        startPeriodicHeartbeats()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_TRACKING -> {
                stopTracking()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_TRIGGER_SOS -> {
                serviceScope.launch {
                    DishaApplication.instance.repository.triggerSOS()
                    updateNotification(lastLocation)
                }
            }
        }
        return START_STICKY
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "DishaTracker::TrackingWakeLock"
        ).apply {
            setReferenceCounted(false)
            acquire(24 * 60 * 60 * 1000L) // Safe 24-hr max duration
        }
    }

    private fun startInForeground() {
        val notification = buildNotification("Starting location monitoring...")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val prefs = DishaApplication.instance.prefs
        if (!prefs.isLoggedIn) {
            stopTracking()
            stopSelf()
            return
        }

        if (!hasLocationPermissions()) {
            updateNotification(null, "Location permission missing or disabled.")
            return
        }

        val isGpsEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
        val isNetEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true

        if (!isGpsEnabled && !isNetEnabled) {
            updateNotification(null, "Device location is turned off.")
            return
        }

        try {
            // Register for high accuracy GPS updates
            if (isGpsEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    LOCATION_MIN_INTERVAL_MS,
                    LOCATION_MIN_DISTANCE_M,
                    this
                )
            }

            // Register for cellular / Wi-Fi network location fallback
            if (isNetEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    LOCATION_MIN_INTERVAL_MS + 5000L,
                    LOCATION_MIN_DISTANCE_M,
                    this
                )
            }

            // Also read immediate last known location if available
            val lastGps = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val lastNet = locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            val best = when {
                lastGps != null && lastNet != null -> if (lastGps.time > lastNet.time) lastGps else lastNet
                lastGps != null -> lastGps
                else -> lastNet
            }
            best?.let { onLocationChanged(it) }
        } catch (e: SecurityException) {
            // Permission revoked at runtime
            updateNotification(null, "Location permission missing or disabled.")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onLocationChanged(location: Location) {
        val prefs = DishaApplication.instance.prefs
        // Never upload location after user logs out
        if (!prefs.isLoggedIn) {
            stopTracking()
            stopSelf()
            return
        }

        lastLocation = location

        val source = when (location.provider) {
            LocationManager.GPS_PROVIDER -> "GPS"
            LocationManager.NETWORK_PROVIDER -> "NETWORK"
            else -> "UNKNOWN"
        }

        val batteryLevel = getBatteryPercentage()
        val networkState = getNetworkType()

        serviceScope.launch {
            DishaApplication.instance.repository.recordAndTransmitLocation(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy,
                source = source,
                batteryLevel = batteryLevel,
                networkState = networkState
            )
            updateNotification(location)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    override fun onProviderEnabled(provider: String) {
        startLocationUpdates()
    }

    override fun onProviderDisabled(provider: String) {
        updateNotification(lastLocation, "GPS disabled on device")
    }

    private fun startPeriodicHeartbeats() {
        heartbeatJob = serviceScope.launch {
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                val prefs = DishaApplication.instance.prefs
                if (!prefs.isLoggedIn) {
                    stopTracking()
                    stopSelf()
                    break
                }
                val battery = getBatteryPercentage()
                val net = getNetworkType()
                val appVersion = "1.0.0"
                DishaApplication.instance.repository.sendHeartbeat(battery, net, appVersion)
            }
        }
    }

    private fun updateNotification(location: Location?, extraStatus: String? = null) {
        val prefs = DishaApplication.instance.prefs
        val statusText = when {
            extraStatus != null -> extraStatus
            prefs.isSosActive -> "EMERGENCY SOS BROADCASTING"
            location != null -> {
                val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(location.time))
                String.format(
                    Locale.US,
                    "Lat: %.5f, Lng: %.5f (±%.0fm, %s)",
                    location.latitude,
                    location.longitude,
                    location.accuracy,
                    timeStr
                )
            }
            else -> "Acquiring GPS fix..."
        }

        val notification = buildNotification(statusText)
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(contentText: String): Notification {
        val prefs = DishaApplication.instance.prefs
        val title = if (prefs.isSosActive) {
            "DISHA - EMERGENCY SOS ACTIVE"
        } else {
            "DISHA 24/7 Location Service"
        }

        val openActivityIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openActivityPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, DishaApplication.CHANNEL_ID_TRACKING)
            .setContentTitle(title)
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_location)
            .setContentIntent(openActivityPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        return builder.build()
    }

    private fun hasLocationPermissions(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun getBatteryPercentage(): Float? {
        val batteryStatus: Intent? = registerReceiver(
            null,
            android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) {
            (level / scale.toFloat()) * 100f
        } else {
            null
        }
    }

    private fun getNetworkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = cm.activeNetwork ?: return "OFFLINE"
        val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return "OFFLINE"
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
            else -> "OTHER"
        }
    }

    private fun stopTracking() {
        try {
            locationManager?.removeUpdates(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        heartbeatJob?.cancel()
        serviceScope.cancel()

        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null

        DishaApplication.instance.prefs.isSosActive = false
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = DishaApplication.instance.prefs
        // If the officer is logged in, ensure foreground tracking service recovers if OS kills the task
        if (prefs.isLoggedIn && hasLocationPermissions()) {
            val restartIntent = Intent(applicationContext, LocationTrackingService::class.java).apply {
                action = ACTION_START_TRACKING
            }
            val restartPendingIntent = PendingIntent.getService(
                applicationContext,
                1002,
                restartIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? android.app.AlarmManager
            alarmManager?.set(
                android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + 1000L,
                restartPendingIntent
            )
        }
    }

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIFICATION_ID = 1001
        const val ACTION_START_TRACKING = "com.disha.action.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.disha.action.STOP_TRACKING"
        const val ACTION_TRIGGER_SOS = "com.disha.action.TRIGGER_SOS"

        private const val LOCATION_MIN_INTERVAL_MS = 10_000L // 10 seconds
        private const val LOCATION_MIN_DISTANCE_M = 5f // 5 meters
        private const val HEARTBEAT_INTERVAL_MS = 60_000L // 60 seconds

        fun start(context: Context) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_START_TRACKING
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }
    }
}
