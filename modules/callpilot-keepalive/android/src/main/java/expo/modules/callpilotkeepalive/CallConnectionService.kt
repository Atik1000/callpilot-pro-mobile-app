package expo.modules.callpilotkeepalive

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import androidx.annotation.RequiresApi

/**
 * Self-managed Telecom integration (Android 8+): CallPilot calls are known to
 * the system, so headsets/watches can answer or end them, Android routes audio
 * and other apps' calls are handled properly. CallPilot still draws its own
 * incoming notification and call screen (self-managed apps must).
 */
@RequiresApi(Build.VERSION_CODES.O)
class CallConnectionService : ConnectionService() {
  override fun onCreateIncomingConnection(
    accountHandle: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ): Connection {
    val uuid = request?.extras?.getString(TelecomBridge.EXTRA_CALL_UUID).orEmpty()
    val connection = CallConnection(applicationContext, uuid)
    connection.setRinging()
    TelecomBridge.connections[uuid] = connection
    return connection
  }

  override fun onCreateIncomingConnectionFailed(
    accountHandle: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ) {
    // Telecom refused (e.g. busy on an emergency call); the notification still shows.
  }
}

@RequiresApi(Build.VERSION_CODES.O)
class CallConnection(private val context: Context, val uuid: String) : Connection() {
  init {
    connectionProperties = PROPERTY_SELF_MANAGED
    connectionCapabilities = CAPABILITY_MUTE
    audioModeIsVoip = true
    setCallerDisplayName("Incoming call", TelecomManager.PRESENTATION_ALLOWED)
  }

  /** Self-managed apps show their own UI; ours is already posted by the push service. */
  override fun onShowIncomingCallUi() {}

  override fun onAnswer() = CallEvents.dispatch(context, "answer", uuid)

  override fun onAnswer(videoState: Int) = onAnswer()

  override fun onReject() {
    CallEvents.dispatch(context, "end", uuid)
    TelecomBridge.end(uuid, DisconnectCause.REJECTED)
  }

  override fun onDisconnect() {
    CallEvents.dispatch(context, "end", uuid)
    TelecomBridge.end(uuid, DisconnectCause.LOCAL)
  }

  override fun onAbort() = onDisconnect()
}

/** Registers the PhoneAccount and tracks live connections by call_uuid. */
object TelecomBridge {
  const val EXTRA_CALL_UUID = "call_uuid"
  private const val ACCOUNT_ID = "callpilot"
  val connections = java.util.concurrent.ConcurrentHashMap<String, Connection>()

  private fun handle(context: Context): PhoneAccountHandle =
    PhoneAccountHandle(ComponentName(context, CallConnectionService::class.java), ACCOUNT_ID)

  private fun registerAccount(context: Context): TelecomManager? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return null
    val account = PhoneAccount.builder(handle(context), "CallPilot")
      .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
      .setSupportedUriSchemes(listOf(PhoneAccount.SCHEME_TEL, PhoneAccount.SCHEME_SIP))
      .build()
    telecom.registerPhoneAccount(account)
    return telecom
  }

  /** Announces a server-push call to Telecom. Best effort: the notification is the UI. */
  fun reportIncoming(context: Context, uuid: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || connections.containsKey(uuid)) return
    try {
      val telecom = registerAccount(context) ?: return
      val extras = Bundle().apply {
        putString(EXTRA_CALL_UUID, uuid)
        putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, Uri.fromParts(PhoneAccount.SCHEME_SIP, "callpilot", null))
      }
      telecom.addNewIncomingCall(handle(context), Bundle().apply { putBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, extras) })
    } catch (_: Exception) {
      // SecurityException/IllegalStateException on some OEM builds: notification-only.
    }
  }

  fun updateCaller(uuid: String, name: String, number: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val connection = connections[uuid] ?: return
    if (name.isNotEmpty()) connection.setCallerDisplayName(name, TelecomManager.PRESENTATION_ALLOWED)
    if (number.isNotEmpty()) connection.setAddress(Uri.fromParts(PhoneAccount.SCHEME_TEL, number, null), TelecomManager.PRESENTATION_ALLOWED)
  }

  fun setActive(uuid: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    connections[uuid]?.setActive()
  }

  fun end(uuid: String, cause: Int = DisconnectCause.REMOTE) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val connection = connections.remove(uuid) ?: return
    try {
      connection.setDisconnected(DisconnectCause(cause))
      connection.destroy()
    } catch (_: Exception) {}
  }

  fun causeFor(reason: String): Int = when (reason) {
    "local" -> DisconnectCause.LOCAL
    "answeredElsewhere" -> DisconnectCause.ANSWERED_ELSEWHERE
    "unanswered", "expired" -> DisconnectCause.MISSED
    "failed" -> DisconnectCause.ERROR
    "declined" -> DisconnectCause.REJECTED
    else -> DisconnectCause.REMOTE
  }
}

/**
 * Native call actions (notification Answer/Decline, headset, watch) for the JS
 * call store. Sent as a module event while JS listens; otherwise handed to
 * the headless line task so a decline still reaches the backend.
 */
object CallEvents {
  @Volatile var listener: ((Map<String, Any>) -> Unit)? = null

  fun dispatch(context: Context, action: String, uuid: String) {
    if (uuid.isEmpty()) return
    if (action != "answer") {
      Ringer.stop()
      Notifications.clearIncomingCall(context)
    }
    val payload = mapOf<String, Any>("action" to action, "call_uuid" to uuid)
    val current = listener
    if (current != null) {
      current(payload)
      return
    }
    try {
      com.facebook.react.HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(
        Intent(context, LineTaskService::class.java)
          .putExtra(LineTaskService.EXTRA_ACTION, action)
          .putExtra(LineTaskService.EXTRA_CALL_UUID, uuid),
      )
    } catch (_: Exception) {}
  }
}
