package com.disha.locationtracker

import com.disha.locationtracker.data.model.HeartbeatPayload
import com.disha.locationtracker.data.model.LocationTelemetryPayload
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class TelemetryContractTest {

    private val gson = Gson()

    @Test
    fun testLocationPayloadMatchesBackendSchema() {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val recordedAt = isoFormat.format(Date())

        val payload = LocationTelemetryPayload(
            clientEventId = "evt-test-12345",
            latitude = 12.9716,
            longitude = 77.5946,
            accuracy = 4.5f,
            recordedAt = recordedAt,
            source = "GPS",
            trackingMode = "NORMAL",
            batteryLevel = 88.5f,
            networkState = "WIFI"
        )

        val json = gson.toJson(payload)
        assertTrue(json.contains("\"clientEventId\":\"evt-test-12345\""))
        assertTrue(json.contains("\"latitude\":12.9716"))
        assertTrue(json.contains("\"longitude\":77.5946"))
        assertTrue(json.contains("\"accuracy\":4.5"))
        assertTrue(json.contains("\"source\":\"GPS\""))
        assertTrue(json.contains("\"trackingMode\":\"NORMAL\""))
        assertTrue(json.contains("\"batteryLevel\":88.5"))
        assertTrue(json.contains("\"networkState\":\"WIFI\""))

        // Deserialize back
        val parsed = gson.fromJson(json, LocationTelemetryPayload::class.java)
        assertEquals(payload.clientEventId, parsed.clientEventId)
        assertEquals(payload.latitude, parsed.latitude, 0.0001)
        assertEquals(payload.longitude, parsed.longitude, 0.0001)
        assertEquals(payload.accuracy, parsed.accuracy, 0.01f)
    }

    @Test
    fun testHeartbeatPayloadMatchesBackendSchema() {
        val payload = HeartbeatPayload(
            personnelId = "pers-officer-99",
            batteryLevel = 92.0f,
            networkState = "CELLULAR",
            appVersion = "1.0.0",
            healthState = "HEALTHY",
            recordedAt = "2026-10-17T11:00:00.000Z"
        )

        val json = gson.toJson(payload)
        assertTrue(json.contains("\"personnelId\":\"pers-officer-99\""))
        assertTrue(json.contains("\"batteryLevel\":92.0"))
        assertTrue(json.contains("\"networkState\":\"CELLULAR\""))
        assertTrue(json.contains("\"healthState\":\"HEALTHY\""))

        val parsed = gson.fromJson(json, HeartbeatPayload::class.java)
        assertEquals("pers-officer-99", parsed.personnelId)
        assertEquals("HEALTHY", parsed.healthState)
    }

    @Test
    fun testCoordinateBounds() {
        // Valid lat/lng ranges
        val validLat = 12.9716
        val validLng = 77.5946
        assertTrue(validLat in -90.0..90.0)
        assertTrue(validLng in -180.0..180.0)

        val invalidLat = 95.0
        assertFalse(invalidLat in -90.0..90.0)
    }
}
