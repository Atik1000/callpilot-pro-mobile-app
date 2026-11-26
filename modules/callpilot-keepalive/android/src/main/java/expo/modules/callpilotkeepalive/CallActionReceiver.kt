package expo.modules.callpilotkeepalive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** "Decline" on the incoming-call notification (no need to open the app). */
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val uuid = intent.getStringExtra(TelecomBridge.EXTRA_CALL_UUID) ?: return
    TelecomBridge.end(uuid, android.telecom.DisconnectCause.REJECTED)
    CallEvents.dispatch(context, "end", uuid)
  }

  companion object {
    const val ACTION_DECLINE = "expo.modules.callpilotkeepalive.DECLINE"
  }
}
