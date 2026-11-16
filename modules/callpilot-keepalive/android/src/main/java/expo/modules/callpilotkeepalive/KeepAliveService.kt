package expo.modules.callpilotkeepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Foreground service that keeps the app process (and its Telnyx WebSocket)
 * alive while the app is minimised or swiped away, so incoming calls still
 * reach the phone. Shows a quiet, persistent "ready for calls" notification.
 */
class KeepAliveService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "CallPilot"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: "Ready for calls on your business line"
    Notifications.ensureChannels(this)

    val notification = NotificationCompat.Builder(this, Notifications.CHANNEL_SERVICE)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(Notifications.openAppIntent(this, null))
      .build()

    ServiceCompat.startForeground(
      this,
      Notifications.ID_SERVICE,
      notification,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      } else {
        0
      },
    )

    if (wakeLock == null) {
      // Partial lock: keeps the CPU servicing the signalling socket; screen stays off.
      wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallPilot::KeepAlive")
        .apply { setReferenceCounted(false); acquire() }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
  }
}

/** Notification channels, intents and the incoming-call alert. */
object Notifications {
  const val CHANNEL_SERVICE = "callpilot_service"
  const val CHANNEL_INCOMING = "callpilot_incoming_call"
  const val ID_SERVICE = 4101
  const val ID_INCOMING = 4102

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_SERVICE, "Phone line status", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Keeps your business line ready for incoming calls"
        setShowBadge(false)
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_INCOMING, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Incoming calls on your business line"
        // The app plays the ringtone itself (InCallManager), so the alert is silent.
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      },
    )
  }

  /** Opens the app, optionally at a deep link (e.g. callpilot://incoming-call). */
  fun openAppIntent(context: Context, deepLink: String?): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent().setPackage(context.packageName)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (deepLink != null) {
      launch.action = Intent.ACTION_VIEW
      launch.data = android.net.Uri.parse(deepLink)
    }
    return PendingIntent.getActivity(
      context,
      if (deepLink != null) 1 else 0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Heads-up / full-screen alert so a call ringing in the background is visible. */
  fun showIncomingCall(context: Context, caller: String, detail: String) {
    ensureChannels(context)
    val open = openAppIntent(context, "callpilot://incoming-call")
    val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING)
      .setContentTitle(caller)
      .setContentText(detail)
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .addAction(0, "Open to answer", open)
      .build()
    context.getSystemService(NotificationManager::class.java).notify(ID_INCOMING, notification)
  }

  fun clearIncomingCall(context: Context) {
    context.getSystemService(NotificationManager::class.java).cancel(ID_INCOMING)
  }
}
