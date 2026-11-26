package expo.modules.callpilotkeepalive

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallPilotKeepAliveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("CallPilotKeepAlive")
    Events("onIncomingCallInvitation")

    OnCreate {
      NativeCalls.eventSink = { value -> sendEvent("onIncomingCallInvitation", value) }
    }
    OnDestroy { NativeCalls.eventSink = null }

    Function("configureSession") { deviceUid: String, organizationUid: String ->
      NativeCallStore.configure(context, deviceUid, organizationUid)
    }
    Function("clearSession") { NativeCallStore.clearSession(context) }
    Function("getPendingInvitation") { NativeCallStore.pending(context)?.toMap() }
    Function("clearInvitation") { callUuid: String -> NativeCalls.clearInvitation(context, callUuid) }
    Function("markCallActive") { callUuid: String -> NativeCalls.markActive(context, callUuid) }
    Function("endCall") { callUuid: String -> NativeCalls.endCall(context, callUuid) }
    Function("getPushDiagnostics") {
      mapOf<String, Any>(
        "native_push_version" to 2,
        "incoming_channel_enabled" to Notifications.incomingChannelEnabled(context),
        "session_configured" to NativeCallStore.enabled(context),
        "notifications_enabled" to androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled(),
        "full_screen_intent_allowed" to (android.os.Build.VERSION.SDK_INT < 34 || context.getSystemService(android.app.NotificationManager::class.java).canUseFullScreenIntent()),
      ) + NativeCallStore.callPushDiagnostics(context)
    }

    /** Foreground support for a real call only; JS must not start this while idle. */
    Function("start") { title: String, body: String ->
      val intent = Intent(context, KeepAliveService::class.java)
        .putExtra(KeepAliveService.EXTRA_TITLE, title)
        .putExtra(KeepAliveService.EXTRA_BODY, body)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stop") {
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

    /** Diagnostic only; a battery exemption never guarantees wake-up. */
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
