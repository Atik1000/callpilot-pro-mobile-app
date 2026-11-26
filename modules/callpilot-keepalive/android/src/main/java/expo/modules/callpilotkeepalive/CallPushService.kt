package expo.modules.callpilotkeepalive

import android.app.ActivityManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * CallPilot server push mode (FCM). The backend sends:
 *
 * - `kind:"incoming_call"` (high-priority data): call_uuid, organization_uid,
 *   sent_at, expires_at. No caller details. The phone rings at once from native
 *   code, then the JS line task fetches the call state; the SDK leg is created
 *   by the backend only after the user answers (POST .../connect/).
 * - `kind:"callpilot_message"` / `"callpilot_alert"`: generic notification;
 *   tapping it opens the message thread / Alerts (content is fetched after auth).
 *
 * Only bounded work happens here, as FCM requires.
 */
class CallPushService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    when (data["kind"]) {
      "incoming_call" -> onIncomingCall(data)
      "callpilot_message", "callpilot_alert" -> onInboxPush(message)
    }
  }

  /**
   * FCM rotated this installation's token: re-register it with the backend
   * right away (headless JS task), or pushes keep going to the old token until
   * the app is next opened. The JS side also re-registers on every launch.
   */
  override fun onNewToken(token: String) {
    if (!LinePrefs.isPushEnabled(this)) return // signed out: nothing to register
    try {
      HeadlessJsTaskService.acquireWakeLockNow(this)
      startService(Intent(this, LineTaskService::class.java).putExtra(LineTaskService.EXTRA_TOKEN_REFRESH, true))
    } catch (_: Exception) {
      // Background start refused: the next launch/foreground registers it.
    }
  }

  private fun onIncomingCall(data: Map<String, String>) {
    if (!LinePrefs.isPushEnabled(this)) return // signed out
    val uuid = data["call_uuid"]?.takeIf { it.isNotBlank() } ?: return
    if (!LinePrefs.markCallSeen(this, uuid)) return // duplicate delivery
    val remaining = expiresAtMs(data["expires_at"])?.let { it - System.currentTimeMillis() } ?: DEFAULT_RING_MS
    if (remaining <= 0) return // expired invitation: never ring

    val ringMs = remaining.coerceAtMost(MAX_RING_MS)
    if (!isAppInForeground()) {
      try {
        ContextCompat.startForegroundService(
          this,
          Intent(this, KeepAliveService::class.java)
            .putExtra(KeepAliveService.EXTRA_TITLE, "CallPilot")
            .putExtra(KeepAliveService.EXTRA_BODY, "Incoming call")
            .putExtra(KeepAliveService.EXTRA_FROM_APP, true)
            .putExtra(KeepAliveService.EXTRA_TIMEOUT_MS, ringMs),
        )
      } catch (_: Exception) {
        // Not allowed (e.g. not delivered as high priority): still ring.
      }
      Notifications.showIncomingCall(this, "Incoming call", "CallPilot · Business line", uuid)
    }
    Ringer.start(this, ringMs)
    TelecomBridge.reportIncoming(this, uuid)

    val payload = JSONObject()
    for (key in listOf("call_uuid", "organization_uid", "sent_at", "expires_at")) {
      data[key]?.let { payload.put(key, it) }
    }
    try {
      HeadlessJsTaskService.acquireWakeLockNow(this)
      startService(Intent(this, LineTaskService::class.java).putExtra(LineTaskService.EXTRA_PUSH, payload.toString()))
    } catch (_: Exception) {
      // Background start refused: the call shows once the user opens the alert.
    }
  }

  /** Lock-screen text stays generic; the app fetches the content after sign-in. */
  private fun onInboxPush(message: RemoteMessage) {
    if (!LinePrefs.isPushEnabled(this)) return
    val data = message.data
    val isAlert = data["kind"] == "callpilot_alert"
    val extras = android.os.Bundle().apply {
      putString(Notifications.EXTRA_KIND, data["kind"])
      data["message_uid"]?.let { putString(Notifications.EXTRA_MESSAGE_UID, it) }
      data["alert_uid"]?.let { putString(Notifications.EXTRA_ALERT_UID, it) }
    }
    val id = (data["message_uid"] ?: data["alert_uid"] ?: data["kind"]).hashCode()
    Notifications.ensureChannels(this)
    val notification = NotificationCompat.Builder(this, Notifications.CHANNEL_INBOX)
      .setContentTitle(message.notification?.title ?: if (isAlert) "New alert" else "New message")
      .setContentText(message.notification?.body ?: "Open CallPilot to view it")
      .setSmallIcon(applicationInfo.icon)
      .setAutoCancel(true)
      .setCategory(if (isAlert) NotificationCompat.CATEGORY_REMINDER else NotificationCompat.CATEGORY_MESSAGE)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setContentIntent(Notifications.openAppIntent(this, null, extras, id))
      .build()
    getSystemService(NotificationManager::class.java).notify(id, notification)
  }

  private fun isAppInForeground(): Boolean {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  companion object {
    private const val DEFAULT_RING_MS = 25_000L
    private const val MAX_RING_MS = 70_000L

    /** ISO-8601 with offset, e.g. 2026-11-18T10:00:25+00:00 (optional fraction / Z). */
    fun expiresAtMs(value: String?): Long? {
      if (value.isNullOrBlank()) return null
      val normalized = value.trim().replace(Regex("\\.\\d+"), "").replace(Regex("Z$"), "+00:00")
      return try {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(normalized)?.time
      } catch (_: Exception) {
        null
      }
    }
  }
}
