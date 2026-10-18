package com.disha.locationtracker.receiver

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.disha.locationtracker.DishaApplication
import com.disha.locationtracker.R
import com.disha.locationtracker.service.LocationTrackingService
import com.disha.locationtracker.ui.MainActivity

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED || intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val prefs = DishaApplication.instance.prefs
            // If the officer is logged in prior to device restart
            if (prefs.isLoggedIn) {
                // Post transparent status notification that tracking was halted while powered off
                postRebootNotification(context)

                // Resume foreground service if login is valid
                LocationTrackingService.start(context)
            }
        }
    }

    private fun postRebootNotification(context: Context) {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, DishaApplication.CHANNEL_ID_TRACKING)
            .setContentTitle("DISHA Tracker - Device Restarted")
            .setContentText("Device was powered off. Resuming continuous location tracking.")
            .setSmallIcon(R.drawable.ic_shield)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(2002, notification)
    }
}
