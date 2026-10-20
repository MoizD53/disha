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
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.disha.locationtracker.DishaApplication
import com.disha.locationtracker.R
import com.disha.locationtracker.ui.MainActivity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class LocationTrackingService : Service(), LocationListener {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var wakeLock: PowerManager.WakeLock? = null

    // Google Play Services Fused Location
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null

    // Fallback Android LocationManager
    private var locationManager: LocationManager? = null

    private var heartbeatJob: Job? = null
    private var offlineSyncJob: Job? = null
    private var lastLocation: Location? = null
    private var isTrackingStarted = false

    override fun onCreate() {
        super.onCreate()
        acquireWakeLock()
        startInForeground()
        startLocationUpdates()
        startPeriodicHeartbeats()
        startPeriodicOfflineSync()
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
            ACTION_START_TRACKING -> {
                // Idempotent: ensure updates are flowing and notification is current
                if (!isTrackingStarted) {
                    startLocationUpdates()
                }
                updateNotification(lastLocation)
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
        val notification = buildNotification("Initializing persistent GPS tracking...")
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

        // Check Google Play Services availability
        val googleApi = GoogleApiAvailability.getInstance()
        val playServicesAvailable = googleApi.isGooglePlayServicesAvailable(this) == ConnectionResult.SUCCESS

        if (playServicesAvailable) {
            startFusedLocationUpdates()
        } else {
            startLocationManagerFallback()
        }
        isTrackingStarted = true
    }

    @SuppressLint("MissingPermission")
    private fun startFusedLocationUpdates() {
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

            val locationRequest = LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                LOCATION_INTERVAL_MS
            )
                .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
                .setMinUpdateDistanceMeters(LOCATION_MIN_DISTANCE_M)
                .setMaxUpdateDelayMillis(LOCATION_MAX_WAIT_MS)
                .setWaitForAccurateLocation(true)
                .build()

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    val location = result.lastLocation ?: return
                    handleNewLocation(location, "FUSED")
                }

                override fun onLocationAvailability(avail: LocationAvailability) {
                    if (!avail.isLocationAvailable) {
                        updateNotification(lastLocation, "Acquiring GPS fix (weak satellite signal)...")
                    }
                }
            }

            fusedLocationClient?.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                Looper.getMainLooper()
            )?.addOnFailureListener {
                // If Play Services request fails, fall back to native LocationManager
                startLocationManagerFallback()
            }

            // Immediately check last known location to prime state
            fusedLocationClient?.lastLocation?.addOnSuccessListener { loc ->
                if (loc != null && lastLocation == null) {
                    handleNewLocation(loc, "FUSED_LAST_KNOWN")
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            startLocationManagerFallback()
        }
    }

    @SuppressLint("MissingPermission")
    private fun startLocationManagerFallback() {
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isGpsEnabled = locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
        val isNetEnabled = locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true

        if (!isGpsEnabled && !isNetEnabled) {
            updateNotification(null, "Device location is turned off in Android Settings.")
            return
        }

        try {
            if (isGpsEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    LOCATION_INTERVAL_MS,
                    LOCATION_MIN_DISTANCE_M,
                    this,
                    Looper.getMainLooper()
                )
            } else if (isNetEnabled) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    LOCATION_INTERVAL_MS + 2000L,
                    LOCATION_MIN_DISTANCE_M,
                    this,
                    Looper.getMainLooper()
                )
            }

            val lastGps = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            lastGps?.let { handleNewLocation(it, "GPS") }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onLocationChanged(location: Location) {
        handleNewLocation(location, if (location.provider == LocationManager.GPS_PROVIDER) "GPS" else "NETWORK")
    }

    private fun handleNewLocation(location: Location, providerSource: String) {
        val prefs = DishaApplication.instance.prefs
        if (!prefs.isLoggedIn) {
            stopTracking()
            stopSelf()
            return
        }

        val isSos = prefs.isSosActive

        // Accuracy filter: reject inaccurate jumps (> 50m) unless SOS emergency broadcast is active
        if (location.hasAccuracy() && location.accuracy > MAX_ACCURACY_METRES && !isSos) {
            updateNotification(lastLocation, "Filtering coarse fix (±${location.accuracy.toInt()}m)...")
            return
        }

        lastLocation = location

        val batteryLevel = getBatteryPercentage()
        val networkState = getNetworkType()
        val fixTimestamp = if (location.time > 0L) location.time else System.currentTimeMillis()

        serviceScope.launch {
            DishaApplication.instance.repository.recordAndTransmitLocation(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy,
                source = providerSource,
                locationTimestamp = fixTimestamp,
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
        updateNotification(lastLocation, "Location service disabled on device")
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

    private fun startPeriodicOfflineSync() {
        offlineSyncJob = serviceScope.launch {
            while (isActive) {
                delay(OFFLINE_SYNC_INTERVAL_MS)
                val prefs = DishaApplication.instance.prefs
                if (!prefs.isLoggedIn) break
                try {
                    DishaApplication.instance.repository.syncOfflineQueue()
                } catch (e: Exception) {
                    // Suppress transient offline exceptions
                }
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
                    "Lat: %.5f, Lng: %.5f (±%.0fm) • %s",
                    location.latitude,
                    location.longitude,
                    location.accuracy,
                    timeStr
                )
            }
            else -> "Acquiring high-accuracy GPS fix..."
        }

        val notification = buildNotification(statusText)
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(contentText: String): Notification {
        val prefs = DishaApplication.instance.prefs
        val title = if (prefs.isSosActive) {
            "DISHA — EMERGENCY SOS ACTIVE"
        } else {
            "DISHA Field Tracker — Tracking Active"
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

        // Action button to stop tracking safely from the notification
        val stopIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = ACTION_STOP_TRACKING
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1003,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, DishaApplication.CHANNEL_ID_TRACKING)
            .setContentTitle(title)
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_location)
            .setContentIntent(openActivityPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(
                R.drawable.ic_location,
                "Stop Tracking",
                stopPendingIntent
            )

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
        isTrackingStarted = false
        try {
            locationCallback?.let { fusedLocationClient?.removeLocationUpdates(it) }
            locationCallback = null
            fusedLocationClient = null
            locationManager?.removeUpdates(this)
            locationManager = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
        heartbeatJob?.cancel()
        offlineSyncJob?.cancel()
        serviceScope.cancel()

        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null

        DishaApplication.instance.prefs.isSosActive = false
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

        // 5-second interval while moving, 3-second fastest, 5-metre distance filter
        private const val LOCATION_INTERVAL_MS = 5_000L
        private const val LOCATION_FASTEST_INTERVAL_MS = 3_000L
        private const val LOCATION_MIN_DISTANCE_M = 5f
        private const val LOCATION_MAX_WAIT_MS = 10_000L
        private const val MAX_ACCURACY_METRES = 50f

        private const val HEARTBEAT_INTERVAL_MS = 60_000L // 60 seconds
        private const val OFFLINE_SYNC_INTERVAL_MS = 30_000L // 30 seconds

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
