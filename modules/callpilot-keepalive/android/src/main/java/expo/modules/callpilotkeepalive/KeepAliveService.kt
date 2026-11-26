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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
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
  private val handler = Handler(Looper.getMainLooper())

  /** A push-woken ring nobody answered (or the app never took over): clean up. */
  private val ringTimeout = Runnable {
    Ringer.stop()
    Notifications.clearIncomingCall(this)
    stopSelf()
  }

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

    // Each start replaces the previous deadline (answering cancels the ring timeout).
    handler.removeCallbacks(ringTimeout)
    val timeoutMs = intent?.getLongExtra(EXTRA_TIMEOUT_MS, 0L) ?: 0L
    if (timeoutMs > 0) handler.postDelayed(ringTimeout, timeoutMs)

    // Android restarted a call-only service (push wake-up mode) after killing
    // the app: there is no line to keep registered, so do not linger.
    if (intent == null && !LinePrefs.isEnabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    if (wakeLock == null) {
      // Partial lock: keeps the CPU servicing the signalling socket; screen stays off.
      wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallPilot::KeepAlive")
        .apply { setReferenceCounted(false); acquire() }
    }

    // Started by Android (sticky restart), a reboot or an app update rather
    // than by the running app: boot the JS line task so the phone registers.
    if (intent?.getBooleanExtra(EXTRA_FROM_APP, false) != true) {
      try {
        com.facebook.react.HeadlessJsTaskService.acquireWakeLockNow(this)
        startService(Intent(this, LineTaskService::class.java))
      } catch (_: Exception) {}
    }
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(ringTimeout)
    Ringer.stop()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_FROM_APP = "fromApp"
    const val EXTRA_TIMEOUT_MS = "timeoutMs"
  }
}

/** Notification channels, intents and the incoming-call alert. */
object Notifications {
  const val CHANNEL_SERVICE = "callpilot_service"
  const val CHANNEL_INCOMING = "callpilot_incoming_call"
  const val ID_SERVICE = 4101
  const val ID_INCOMING = 4102
  const val CHANNEL_MISSED = "callpilot_missed_call"
  const val ID_MISSED = 4103
  const val CHANNEL_INBOX = "callpilot_inbox"

  /** Intent extras on a tapped message/alert notification (read by the JS side). */
  const val EXTRA_KIND = "kind"
  const val EXTRA_MESSAGE_UID = "message_uid"
  const val EXTRA_ALERT_UID = "alert_uid"

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
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_MISSED, "Missed calls", NotificationManager.IMPORTANCE_DEFAULT),
    )
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_INBOX, "Messages & alerts", NotificationManager.IMPORTANCE_HIGH).apply {
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      },
    )
  }

  fun showMissedCall(context: Context, caller: String) {
    ensureChannels(context)
    val notification = NotificationCompat.Builder(context, CHANNEL_MISSED)
      .setContentTitle("Missed call")
      .setContentText(caller)
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
      .setAutoCancel(true)
      .setContentIntent(openAppIntent(context, null))
      .build()
    context.getSystemService(NotificationManager::class.java).notify(ID_MISSED, notification)
  }

  /** Opens the app (bringing it to the front if running), optionally at a deep link. */
  fun openAppIntent(
    context: Context,
    deepLink: String?,
    extras: android.os.Bundle? = null,
    requestCode: Int? = null,
  ): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent().setPackage(context.packageName)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (deepLink != null) {
      launch.action = Intent.ACTION_VIEW
      launch.data = android.net.Uri.parse(deepLink)
    }
    if (extras != null) launch.putExtras(extras)
    return PendingIntent.getActivity(
      context,
      requestCode ?: if (deepLink != null) 1 else 0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  @Volatile private var incomingShown = false

  /**
   * Heads-up / full-screen alert so a call ringing in the background is visible.
   * Posted once per call: re-posting re-fires the full-screen intent, which
   * makes the screen flash. The app shows the call screen itself once open, so
   * the alert only brings it to the front (a deep link would stack a second
   * call screen on top).
   */
  const val EXTRA_CALL_ACTION = "call_action"

  /**
   * `callUuid` (server-push calls): adds real Answer / Decline buttons.
   * `update`: refreshes the caller name without re-firing the full-screen intent.
   */
  fun showIncomingCall(
    context: Context,
    caller: String,
    detail: String,
    callUuid: String? = null,
    update: Boolean = false,
  ) {
    if (update) {
      if (!incomingShown) return
    } else {
      if (incomingShown) return
      incomingShown = true
    }
    ensureChannels(context)
    val open = openAppIntent(context, null)
    val builder = NotificationCompat.Builder(context, CHANNEL_INCOMING)
      .setContentTitle(caller)
      .setContentText(detail)
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(open)
    if (!update) builder.setFullScreenIntent(open, true)
    if (callUuid != null) {
      val answer = openAppIntent(
        context,
        null,
        android.os.Bundle().apply {
          putString(EXTRA_CALL_ACTION, "answer")
          putString(TelecomBridge.EXTRA_CALL_UUID, callUuid)
        },
        2,
      )
      val decline = PendingIntent.getBroadcast(
        context,
        3,
        Intent(context, CallActionReceiver::class.java)
          .setAction(CallActionReceiver.ACTION_DECLINE)
          .putExtra(TelecomBridge.EXTRA_CALL_UUID, callUuid),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      builder.addAction(0, "Decline", decline).addAction(0, "Answer", answer)
    } else {
      builder.addAction(0, "Open to answer", open)
    }
    context.getSystemService(NotificationManager::class.java).notify(ID_INCOMING, builder.build())
  }

  fun clearIncomingCall(context: Context) {
    incomingShown = false
    context.getSystemService(NotificationManager::class.java).cancel(ID_INCOMING)
  }
}
