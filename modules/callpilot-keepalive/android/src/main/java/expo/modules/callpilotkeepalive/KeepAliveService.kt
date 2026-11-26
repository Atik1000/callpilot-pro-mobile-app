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
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/** Foreground execution exists only around a real call, never for idle SIP registration. */
class KeepAliveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Do not restart a socket or a finished call after process death/boot.
    if (intent == null) { stopSelf(); return START_NOT_STICKY }
    val id = intent.getStringExtra(NativeCalls.EXTRA_CALL_UUID)
    if (id == null) NativeCalls.legacyCallActive = true
    val pending = NativeCallStore.pending(this)?.takeIf { it.callUuid == id && it.action != "decline" }
    if (id != null && pending == null) { stopSelf(); return START_NOT_STICKY }
    val notification = if (pending != null) Notifications.nativeCall(this, pending, pending.active)
      else Notifications.legacyActiveCall(this, intent.getStringExtra(EXTRA_TITLE) ?: "CallPilot",
        intent.getStringExtra(EXTRA_BODY) ?: "Call in progress")
    try {
      ServiceCompat.startForeground(this, Notifications.ID_INCOMING, notification,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL else 0)
    } catch (_: Exception) { stopSelf() }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    NativeCalls.legacyCallActive = false
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
  }
}

/** Native call notifications are shown before JS/auth/network initialization. */
object Notifications {
  // New channel avoids retaining the old silent-only incoming channel settings.
  const val CHANNEL_INCOMING = "callpilot-native-incoming-v2"
  const val CHANNEL_ACTIVE = "callpilot-active-calls-v2"
  const val ID_INCOMING = 4102

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL_INCOMING, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Incoming business calls"
      setSound(null, null) // Bounded native ringer respects the system volume/silent mode.
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    })
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ACTIVE, "Active calls", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Calls currently in progress"
      setShowBadge(false)
      setSound(null, null)
    })
  }

  fun openAppIntent(context: Context, deepLink: String?): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent().setPackage(context.packageName)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    if (deepLink != null) { launch.action = Intent.ACTION_VIEW; launch.data = android.net.Uri.parse(deepLink) }
    return PendingIntent.getActivity(context, if (deepLink != null) 1 else 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun incomingActivity(context: Context, invitation: NativeInvitation, answer: Boolean = false): PendingIntent {
    val intent = Intent(context, IncomingCallActivity::class.java)
      .setAction(if (answer) NativeCalls.ACTION_ANSWER else Intent.ACTION_VIEW)
      .setData(android.net.Uri.parse("callpilot-native://call/${invitation.callUuid}/${if (answer) "answer" else "open"}"))
      .putExtra(NativeCalls.EXTRA_CALL_UUID, invitation.callUuid)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, if (answer) 2 else 1, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun declineIntent(context: Context, invitation: NativeInvitation): PendingIntent {
    val intent = Intent(context, CallPilotActionReceiver::class.java).setAction(NativeCalls.ACTION_DECLINE)
      .setData(android.net.Uri.parse("callpilot-native://call/${invitation.callUuid}/decline"))
      .putExtra(NativeCalls.EXTRA_CALL_UUID, invitation.callUuid)
    return PendingIntent.getBroadcast(context, 3, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun nativeCall(context: Context, invitation: NativeInvitation, active: Boolean): Notification {
    ensureChannels(context)
    val open = if (active) openAppIntent(context, "callpilot://active-call") else incomingActivity(context, invitation)
    val builder = NotificationCompat.Builder(context, if (active) CHANNEL_ACTIVE else CHANNEL_INCOMING)
      .setContentTitle("CallPilot")
      .setContentText(if (active) "Business call in progress" else if (invitation.action == "answer") "Connecting business call…" else "Incoming business call")
      .setSmallIcon(context.applicationInfo.icon)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(if (active) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setContentIntent(open)
    if (!active) {
      builder.setTimeoutAfter(maxOf(1, invitation.expiresMillis() - System.currentTimeMillis()))
      if (invitation.action == "open") {
        if (Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()) {
          builder.setFullScreenIntent(open, true)
        }
        val person = androidx.core.app.Person.Builder().setName("CallPilot").setImportant(true).build()
        builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person, declineIntent(context, invitation), incomingActivity(context, invitation, true)))
      }
    } else {
      val person = androidx.core.app.Person.Builder().setName("CallPilot").setImportant(true).build()
      builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(person, declineIntent(context, invitation)))
    }
    return builder.build()
  }

  fun showNativeCall(context: Context, invitation: NativeInvitation, active: Boolean) {
    runCatching { context.getSystemService(NotificationManager::class.java).notify(ID_INCOMING, nativeCall(context, invitation, active)) }
  }

  fun legacyActiveCall(context: Context, title: String, body: String): Notification {
    ensureChannels(context)
    return NotificationCompat.Builder(context, CHANNEL_ACTIVE).setContentTitle(title).setContentText(body)
      .setSmallIcon(context.applicationInfo.icon).setOngoing(true).setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_CALL).setContentIntent(openAppIntent(context, "callpilot://active-call")).build()
  }

  /** Compatibility for existing in-process SDK call presentation. */
  fun showIncomingCall(context: Context, caller: String, detail: String) {
    val pending = NativeCallStore.pending(context)
    if (pending != null) { if (!pending.active) showNativeCall(context, pending, false); return }
    ensureChannels(context)
    val open = openAppIntent(context, "callpilot://incoming-call")
    val builder = NotificationCompat.Builder(context, CHANNEL_INCOMING).setContentTitle(caller).setContentText(detail)
      .setSmallIcon(context.applicationInfo.icon).setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX).setOngoing(true).setContentIntent(open).setTimeoutAfter(60_000)
    if (Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()) builder.setFullScreenIntent(open, true)
    context.getSystemService(NotificationManager::class.java).notify(ID_INCOMING, builder.build())
  }

  fun clearIncomingCall(context: Context) { context.getSystemService(NotificationManager::class.java).cancel(ID_INCOMING) }
}
