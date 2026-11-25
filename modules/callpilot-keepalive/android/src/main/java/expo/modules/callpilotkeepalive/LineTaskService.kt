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
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(TASK_NAME, Arguments.createMap(), 30_000, true)

  companion object {
    const val TASK_NAME = "CallPilotLineTask"
  }
}
