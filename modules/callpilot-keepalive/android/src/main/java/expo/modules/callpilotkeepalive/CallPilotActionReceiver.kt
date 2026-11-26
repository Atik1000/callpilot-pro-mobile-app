package expo.modules.callpilotkeepalive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Explicit, unexported notification actions; never accepts a supplied account. */
class CallPilotActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val uuid = intent.getStringExtra(NativeCalls.EXTRA_CALL_UUID) ?: return
    if (intent.action == NativeCalls.ACTION_DECLINE) NativeCalls.decline(context, uuid)
  }
}
