package expo.modules.callpilotkeepalive

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Bounded authenticated decline/end work; never an idle socket registration task. */
class CallPilotPushActionService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val uuid = intent?.getStringExtra(NativeCalls.EXTRA_CALL_UUID) ?: return null
    val invitation = NativeCallStore.pending(this)?.takeIf { it.callUuid == uuid && it.action == "decline" } ?: return null
    val data = Arguments.createMap().apply {
      putString("call_uuid", invitation.callUuid)
      putString("organization_uid", invitation.organizationUid)
      putString("expires_at", invitation.expiresAt)
      putString("action", invitation.action)
      putBoolean("call_active", invitation.active)
    }
    return HeadlessJsTaskConfig("CallPilotPushAction", data, 20_000, true)
  }
}
