package expo.modules.callpilotkeepalive

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService

class CallPilotConnectionService : ConnectionService() {
  override fun onCreateIncomingConnection(account: PhoneAccountHandle?, request: ConnectionRequest): Connection {
    val id = request.extras?.getString(NativeCalls.EXTRA_CALL_UUID)
    val invitation = NativeCallStore.pending(this)?.takeIf { it.callUuid == id && it.action != "decline" }
      ?: return Connection.createFailedConnection(DisconnectCause(DisconnectCause.CANCELED))
    return CallPilotConnection(applicationContext, invitation.callUuid).also {
      NativeCalls.attach(invitation.callUuid, it)
      if (invitation.active) it.setActive() else it.setRinging()
    }
  }

  override fun onCreateIncomingConnectionFailed(account: PhoneAccountHandle?, request: ConnectionRequest) {
    val id = request.extras?.getString(NativeCalls.EXTRA_CALL_UUID) ?: return
    NativeCalls.decline(this, id)
  }
}

class CallPilotConnection(private val context: Context, val callUuid: String) : Connection() {
  init {
    connectionProperties = PROPERTY_SELF_MANAGED
    setAudioModeIsVoip(true)
    setAddress(Uri.fromParts("callpilot", callUuid, null), TelecomManager.PRESENTATION_RESTRICTED)
    setCallerDisplayName("CallPilot", TelecomManager.PRESENTATION_ALLOWED)
  }
  override fun onShowIncomingCallUi() { NativeCalls.present(context, callUuid) }
  override fun onAnswer() { NativeCalls.answer(context, callUuid) }
  override fun onAnswer(videoState: Int) { onAnswer() }
  override fun onReject() { NativeCalls.decline(context, callUuid) }
  override fun onReject(reason: Int) { onReject() }
  override fun onDisconnect() { NativeCalls.decline(context, callUuid) }
  override fun onAbort() { NativeCalls.decline(context, callUuid) }
}

/** Coordinates OS call state without a persistent JS engine or credentials. */
object NativeCalls {
  const val EXTRA_CALL_UUID = "callpilot_call_uuid"
  const val ACTION_ANSWER = "pro.callpilot.NATIVE_ANSWER"
  const val ACTION_DECLINE = "pro.callpilot.NATIVE_DECLINE"
  private val handler = Handler(Looper.getMainLooper())
  private val connections = mutableMapOf<String, CallPilotConnection>()
  @Volatile private var activeInvitation: NativeInvitation? = null
  @Volatile var legacyCallActive: Boolean = false
  private var expiry: Runnable? = null
  @Volatile var eventSink: ((Map<String, Any>) -> Unit)? = null

  fun hasActiveCall(): Boolean = activeInvitation != null || legacyCallActive
  fun isActive(id: String): Boolean = activeInvitation?.callUuid == id
  fun attach(id: String, connection: CallPilotConnection) { synchronized(connections) { connections[id] = connection } }
  private fun connection(id: String) = synchronized(connections) { connections[id] }

  fun receive(context: Context, invitation: NativeInvitation) {
    // Publish the visible call notification within the FCM callback lifetime.
    // Do not wait for React, network work, or a later main-thread callback.
    if (!NativeCallStore.enabled(context) || NativeCallStore.pending(context)?.callUuid != invitation.callUuid) return
    Notifications.showNativeCall(context, invitation, false)
    handler.post {
      if (!NativeCallStore.enabled(context) || NativeCallStore.pending(context)?.callUuid != invitation.callUuid) return@post
      present(context, invitation.callUuid)
      try {
        val telecom = context.getSystemService(TelecomManager::class.java)
        val account = PhoneAccountHandle(ComponentName(context, CallPilotConnectionService::class.java), "callpilot-native")
        telecom.registerPhoneAccount(PhoneAccount.builder(account, "CallPilot")
          .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED).build())
        telecom.addNewIncomingCall(account, Bundle().apply { putString(EXTRA_CALL_UUID, invitation.callUuid) })
      } catch (_: Exception) {
        // Visible notification remains available if Telecom cannot add this call.
        Log.w("CallPilotPush", "telecom_registration_unavailable")
      }
      emit(invitation)
    }
  }

  fun present(context: Context, id: String) {
    val invitation = NativeCallStore.pending(context)?.takeIf { it.callUuid == id && !it.active && it.action != "decline" } ?: return
    Notifications.showNativeCall(context, invitation, false)
    Ringer.start(context)
    try {
      ContextCompat.startForegroundService(context, Intent(context, KeepAliveService::class.java).putExtra(EXTRA_CALL_UUID, id))
    } catch (_: Exception) {
      Log.w("CallPilotPush", "foreground_call_service_unavailable")
    }
    expiry?.let(handler::removeCallbacks)
    expiry = Runnable {
      if (activeInvitation?.callUuid != id) clearInvitation(context, id)
    }.also { handler.postDelayed(it, maxOf(1, invitation.expiresMillis() - System.currentTimeMillis())) }
  }

  fun answer(context: Context, id: String) {
    val invitation = NativeCallStore.action(context, id, "answer")?.takeIf { !it.active } ?: return
    Ringer.stop()
    Notifications.showNativeCall(context, invitation, false)
    emit(invitation)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.action = Intent.ACTION_VIEW
    launch.data = Uri.parse("callpilot://incoming-call?call_uuid=$id")
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    try {
      // A user action on the native UI/Telecom initiated this launch.
      context.startActivity(launch)
    } catch (_: Exception) { Log.w("CallPilotPush", "answer_app_launch_unavailable") }
  }

  fun decline(context: Context, id: String) {
    val current = NativeCallStore.pending(context)?.takeIf { it.callUuid == id }
      ?: activeInvitation?.takeIf { it.callUuid == id } ?: return
    val invitation = current.copy(action = "decline", actionAt = System.currentTimeMillis())
    NativeCallStore.save(context, invitation)
    Ringer.stop()
    Notifications.clearIncomingCall(context)
    finishConnection(id, if (current.active) DisconnectCause.LOCAL else DisconnectCause.REJECTED)
    if (activeInvitation?.callUuid == id) activeInvitation = null
    context.stopService(Intent(context, KeepAliveService::class.java))
    emit(invitation)
    try {
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, CallPilotPushActionService::class.java).putExtra(EXTRA_CALL_UUID, id))
    } catch (_: Exception) {
      // Durable pending action is replayed when the app next starts.
      Log.w("CallPilotPush", "decline_background_dispatch_unavailable")
    }
  }

  fun markActive(context: Context, id: String) {
    val invitation = NativeCallStore.pending(context)?.takeIf { it.callUuid == id && it.action != "decline" }
      ?: activeInvitation?.takeIf { it.callUuid == id } ?: return
    activeInvitation = invitation.copy(active = true, action = "answer")
    NativeCallStore.save(context, activeInvitation!!)
    expiry?.let(handler::removeCallbacks)
    expiry = null
    Ringer.stop()
    connection(id)?.setActive()
    Notifications.showNativeCall(context, activeInvitation!!, true)
    try {
      ContextCompat.startForegroundService(context, Intent(context, KeepAliveService::class.java).putExtra(EXTRA_CALL_UUID, id))
    } catch (_: Exception) { Log.w("CallPilotPush", "active_call_service_unavailable") }
  }

  /** Invitation timeout/dismissal never terminates a confirmed connected call. */
  fun clearInvitation(context: Context, id: String) {
    val current = NativeCallStore.pending(context)
    if (current != null && current.callUuid != id) { finishConnection(id, DisconnectCause.CANCELED); return }
    if (activeInvitation?.callUuid == id) return
    NativeCallStore.clear(context, id)
    expiry?.let(handler::removeCallbacks)
    expiry = null
    Ringer.stop()
    Notifications.clearIncomingCall(context)
    finishConnection(id, DisconnectCause.CANCELED)
    context.stopService(Intent(context, KeepAliveService::class.java))
  }

  /** Explicit SDK end/logout, as opposed to the original invitation deadline. */
  fun endCall(context: Context, id: String) {
    val current = NativeCallStore.pending(context)
    if (current != null && current.callUuid != id && activeInvitation?.callUuid != id) { finishConnection(id, DisconnectCause.LOCAL); return }
    if (activeInvitation?.callUuid == id) activeInvitation = null
    NativeCallStore.clear(context, id)
    expiry?.let(handler::removeCallbacks)
    expiry = null
    Ringer.stop()
    Notifications.clearIncomingCall(context)
    finishConnection(id, DisconnectCause.LOCAL)
    context.stopService(Intent(context, KeepAliveService::class.java))
  }

  fun clearAll(context: Context) {
    activeInvitation = null
    legacyCallActive = false
    expiry?.let(handler::removeCallbacks)
    expiry = null
    val ids = synchronized(connections) { connections.keys.toList() }
    ids.forEach { finishConnection(it, DisconnectCause.LOCAL) }
    Ringer.stop()
    Notifications.clearIncomingCall(context)
    context.stopService(Intent(context, KeepAliveService::class.java))
  }

  private fun finishConnection(id: String, cause: Int) {
    val value = synchronized(connections) { connections.remove(id) } ?: return
    value.setDisconnected(DisconnectCause(cause))
    value.destroy()
  }

  private fun emit(invitation: NativeInvitation) { eventSink?.invoke(invitation.toMap()) }
}
