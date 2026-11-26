package expo.modules.callpilotkeepalive

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallPilotKeepAliveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  /** kind/message_uid/alert_uid from our own or a system-displayed FCM notification. */
  private fun notificationPayload(intent: Intent): Map<String, String>? {
    val kind = intent.getStringExtra(Notifications.EXTRA_KIND)
    if (kind != "callpilot_message" && kind != "callpilot_alert") return null
    val payload = mutableMapOf("kind" to kind)
    intent.getStringExtra(Notifications.EXTRA_MESSAGE_UID)?.let { payload["message_uid"] = it }
    intent.getStringExtra(Notifications.EXTRA_ALERT_UID)?.let { payload["alert_uid"] = it }
    return payload
  }

  private fun callAction(intent: Intent): Map<String, String>? {
    val action = intent.getStringExtra(Notifications.EXTRA_CALL_ACTION) ?: return null
    val uuid = intent.getStringExtra(TelecomBridge.EXTRA_CALL_UUID) ?: return null
    return mapOf("action" to action, "call_uuid" to uuid)
  }

  override fun definition() = ModuleDefinition {
    Name("CallPilotKeepAlive")

    Events("onNotificationOpened", "onCallAction")

    OnStartObserving {
      CallEvents.listener = { payload -> sendEvent("onCallAction", payload) }
    }

    OnStopObserving {
      CallEvents.listener = null
    }

    /** A message/alert notification or the call "Answer" button tapped while running. */
    OnNewIntent { intent ->
      notificationPayload(intent)?.let { sendEvent("onNotificationOpened", it) }
      callAction(intent)?.let { sendEvent("onCallAction", it) }
    }

    /** The "Answer" tap that launched the app, once (then cleared). */
    Function("getLaunchCallAction") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val action = callAction(intent) ?: return@Function null
      intent.removeExtra(Notifications.EXTRA_CALL_ACTION)
      action
    }

    /** Caller details for the Telecom call and the incoming notification. */
    Function("updateCall") { uuid: String, name: String, number: String, whatsapp: Boolean ->
      TelecomBridge.updateCaller(uuid, name, number)
      val label = if (whatsapp) "Incoming WhatsApp call" else "Incoming call"
      Notifications.showIncomingCall(context, name.ifEmpty { number.ifEmpty { "Incoming call" } }, "$label · Business line", uuid, update = true)
    }

    /** Answered in the app: Telecom keeps ringing state until media connects. */
    Function("answerCall") { _: String -> Ringer.stop() }

    Function("callConnected") { uuid: String -> TelecomBridge.setActive(uuid) }

    Function("endCall") { uuid: String, reason: String ->
      TelecomBridge.end(uuid, TelecomBridge.causeFor(reason))
    }

    /** The message/alert notification that launched the app, once (then cleared). */
    Function("getLaunchNotification") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val payload = notificationPayload(intent) ?: return@Function null
      intent.removeExtra(Notifications.EXTRA_KIND)
      payload
    }

    /** Starts (or updates) the foreground "ready for calls" service. */
    Function("start") { title: String, body: String ->
      val intent = Intent(context, KeepAliveService::class.java)
        .putExtra(KeepAliveService.EXTRA_TITLE, title)
        .putExtra(KeepAliveService.EXTRA_BODY, body)
        .putExtra(KeepAliveService.EXTRA_FROM_APP, true)
      LinePrefs.setEnabled(context, true)
      ContextCompat.startForegroundService(context, intent)
    }

    /**
     * Foreground service for one call only (push wake-up mode): keeps the app
     * alive while a call rings or is in progress, without re-registering the
     * line after reboots. Cancels a pending ring timeout.
     */
    Function("startForCall") { title: String, body: String ->
      val intent = Intent(context, KeepAliveService::class.java)
        .putExtra(KeepAliveService.EXTRA_TITLE, title)
        .putExtra(KeepAliveService.EXTRA_BODY, body)
        .putExtra(KeepAliveService.EXTRA_FROM_APP, true)
      ContextCompat.startForegroundService(context, intent)
    }

    /**
     * Push wake-up on: incoming-call pushes ring this phone and the always-on
     * line service is no longer restored after reboots. Off: pushes are ignored.
     */
    Function("setPushMode") { on: Boolean ->
      LinePrefs.setPushEnabled(context, on)
      if (on) LinePrefs.setEnabled(context, false)
    }

    /** This device's FCM token, or null when Firebase is not configured in the build. */
    AsyncFunction("getPushToken") { promise: Promise ->
      try {
        FirebaseMessaging.getInstance().token
          .addOnSuccessListener { token -> promise.resolve(token) }
          .addOnFailureListener { promise.resolve(null) }
      } catch (_: Exception) {
        // No google-services.json in this build: FirebaseApp is not initialised.
        promise.resolve(null)
      }
    }

    Function("stop") {
      LinePrefs.setEnabled(context, false)
      Ringer.stop()
      context.stopService(Intent(context, KeepAliveService::class.java))
      Notifications.clearIncomingCall(context)
    }

    /** Visible alert for a call that rings while the app is in the background. */
    Function("showIncomingCall") { caller: String, detail: String ->
      Notifications.showIncomingCall(context, caller, detail)
    }

    /** Loud ringtone + vibration (respects the phone's Silent/Vibrate switch). */
    Function("startRinging") {
      Ringer.start(context)
    }

    Function("stopRinging") {
      Ringer.stop()
    }

    /** Lets the incoming-call screen appear over the lock screen and wake it, only while ringing. */
    Function("setShowOverLockScreen") { on: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(on)
          activity.setTurnScreenOn(on)
        } else {
          @Suppress("DEPRECATION")
          val flags = android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
          if (on) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
        }
      }
    }

    Function("clearIncomingCall") {
      Notifications.clearIncomingCall(context)
    }

    /** True when Android will not put the app to sleep (needed on Vivo/Xiaomi/etc.). */
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** Opens the system prompt to exempt CallPilot from battery optimisation. */
    Function("requestIgnoreBatteryOptimizations") {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        context.startActivity(
          Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }
  }
}
