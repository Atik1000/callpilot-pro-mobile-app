package expo.modules.callpilotkeepalive

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/** Runs without a React screen/runtime. Expo retains ordinary notification handling. */
class CallPilotMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (message.data["kind"] != "incoming_call") {
      super.onMessageReceived(message)
      return
    }
    // Record entry before validation: a late/blocked session is distinguishable
    // from Firebase never starting this process. Values contain no payload IDs.
    NativeCallStore.recordCallPushReceived(this, message.priority, message.originalPriority)
    val invitation = NativeCallStore.accept(this, message.data) ?: return
    NativeCalls.receive(this, invitation)
  }

  override fun onNewToken(token: String) {
    // Expo emits the token-rotation event; authenticated JS registers it with CallPilot.
    // Do not store a JWT or print a push token in a native log.
    super.onNewToken(token)
  }
}
