package expo.modules.callpilotkeepalive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Brings the business line back after a reboot or app update (if signed in). */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!LinePrefs.isEnabled(context)) return
    try {
      ContextCompat.startForegroundService(context, Intent(context, KeepAliveService::class.java))
    } catch (_: Exception) {
      // Some OEMs block starts from boot; the line comes back when the app is opened.
    }
  }
}

/** Remembers whether the line should run (signed in) across restarts. */
object LinePrefs {
  private const val FILE = "callpilot_line"
  private const val KEY = "enabled"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY, enabled).apply()
  }
}
