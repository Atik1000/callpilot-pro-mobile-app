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
  private const val KEY_PUSH = "push"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY, enabled).apply()
  }

  /** True while signed in with push wake-up: incoming-call pushes should ring. */
  fun isPushEnabled(context: Context): Boolean =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_PUSH, false)

  fun setPushEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_PUSH, enabled).apply()
  }

  private const val KEY_SEEN = "seen_calls"

  /** Records a call_uuid; false when it was already shown (backend retries delivery). */
  @Synchronized
  fun markCallSeen(context: Context, uuid: String): Boolean {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val seen = prefs.getString(KEY_SEEN, "")!!.split(',').filter { it.isNotBlank() }
    if (uuid in seen) return false
    prefs.edit().putString(KEY_SEEN, (seen + uuid).takeLast(20).joinToString(",")).apply()
    return true
  }
}
