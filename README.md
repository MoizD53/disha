# DISHA Field Tracker (Android Native)

A native Android application built from scratch for transparent, consent-based, 24/7 field-personnel location tracking, connected to the DISHA command center and backend.

## Key Features

1. **Transparent & Consent-Driven Duty Tracking**:
   - Explicit informed consent dialog explaining GPS telemetry collection before duty starts.
   - Start / End Duty lifecycle controls.
   - Emergency SOS broadcast trigger and cancellation controls.
2. **Foreground Location Service**:
   - `LocationTrackingService` runs as an Android Foreground Service (`foregroundServiceType="location"`) with a persistent status notification.
   - Employs Android `LocationManager` with high-accuracy GPS and cellular/Wi-Fi network fallback.
   - Partial `WakeLock` to maintain location polling reliability.
3. **Offline Queue & Resilient Telemetry**:
   - Embedded SQLite database (`OfflineLocationDbHelper`) automatically buffers telemetry during network interruptions.
   - Automatic queue drainage and manual "Sync Now" button when network connectivity is restored.
   - Idempotent updates with unique UUID `clientEventId`.
4. **Periodic Heartbeats**:
   - Transmits device health, battery percentage, network state, and app version to `/api/telemetry/heartbeat` every 60 seconds.
5. **Truthful & Transparent System Claims**:
   - Clear diagnostic disclosures: Location tracking cannot function if the device is powered off, battery is depleted, permissions are revoked, or the app is force-stopped by the user.
   - Live display of GPS coordinates, accuracy, network state, battery level, and battery optimization status.

## Project Structure

```
D:\Projects\location-tracker-android
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/disha/locationtracker/
│       │   ├── DishaApplication.kt
│       │   ├── data/
│       │   │   ├── local/
│       │   │   │   ├── AppPreferences.kt
│       │   │   │   └── OfflineLocationDbHelper.kt
│       │   │   ├── model/Models.kt
│       │   │   ├── remote/ApiClient.kt
│       │   │   └── repository/TrackerRepository.kt
│       │   ├── receiver/BootReceiver.kt
│       │   ├── service/LocationTrackingService.kt
│       │   └── ui/
│       │       ├── LoginActivity.kt
│       │       └── MainActivity.kt
│       └── res/
│           ├── layout/
│           │   ├── activity_login.xml
│           │   ├── activity_main.xml
│           │   └── dialog_consent.xml
│           ├── drawable/
│           └── values/
├── build-apk.bat
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── local.properties
└── gradlew.bat
```

## How to Build

From Windows Command Prompt (CMD) or PowerShell:

```cmd
cd /d D:\Projects\location-tracker-android
build-apk.bat
```

Or directly via Gradle Wrapper:

```cmd
cd /d D:\Projects\location-tracker-android
gradlew.bat assembleDebug
```

## Generated APK Location

Upon successful build:
`D:\Projects\location-tracker-android\app\build\outputs\apk\debug\app-debug.apk`
