package expo.modules.callpilotkeepalive

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Starts the JavaScript side without opening the app screen, so the business
 * line reconnects after a reboot, an app update, or Android restarting the
 * service. The JS task ("CallPilotLineTask") restores the session and
 * registers the phone line.
 */
class LineTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    val data = Arguments.createMap()
    // Set when a CallPilot incoming-call push woke the app (its data as JSON).
    intent?.getStringExtra(EXTRA_PUSH)?.let { data.putString("push", it) }
    // A native call action (notification Decline, headset) while JS was not listening.
    intent?.getStringExtra(EXTRA_ACTION)?.let { data.putString("action", it) }
    intent?.getStringExtra(EXTRA_CALL_UUID)?.let { data.putString("call_uuid", it) }
    // FCM rotated the push token: register the new one with the backend.
    if (intent?.getBooleanExtra(EXTRA_TOKEN_REFRESH, false) == true) data.putBoolean("tokenRefresh", true)
    return HeadlessJsTaskConfig(TASK_NAME, data, 30_000, true)
  }

  companion object {
    const val TASK_NAME = "CallPilotLineTask"
    const val EXTRA_PUSH = "push"
    const val EXTRA_ACTION = "action"
    const val EXTRA_CALL_UUID = "call_uuid"
    const val EXTRA_TOKEN_REFRESH = "token_refresh"
  }
}
