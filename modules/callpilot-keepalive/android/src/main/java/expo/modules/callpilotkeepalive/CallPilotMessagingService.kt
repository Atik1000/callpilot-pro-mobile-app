package expo.modules.callpilotkeepalive

import android.util.Log
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/** Runs without a React screen/runtime. Expo retains ordinary notification handling. */
class CallPilotMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (message.data["kind"] != "incoming_call") {
      super.onMessageReceived(message)
      return
    }
    val invitation = NativeCallStore.accept(this, message.data) ?: return
    Log.i("CallPilotPush", "incoming_call_received")
    NativeCalls.receive(this, invitation)
  }

  override fun onNewToken(token: String) {
    // Expo emits the token-rotation event; authenticated JS registers it with CallPilot.
    // Do not store a JWT or print a push token in a native log.
    super.onNewToken(token)
  }
}
