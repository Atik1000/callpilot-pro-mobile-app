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

    /** Starts (or updates) the foreground "ready for calls" service. */
    Function("start") { title: String, body: String ->
      val intent = Intent(context, KeepAliveService::class.java)
        .putExtra(KeepAliveService.EXTRA_TITLE, title)
        .putExtra(KeepAliveService.EXTRA_BODY, body)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stop") {
      context.stopService(Intent(context, KeepAliveService::class.java))
      Notifications.clearIncomingCall(context)
    }

    /** Visible alert for a call that rings while the app is in the background. */
    Function("showIncomingCall") { caller: String, detail: String ->
      Notifications.showIncomingCall(context, caller, detail)
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
