package expo.modules.callpilotkeepalive

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Lightweight OS call UI: usable before React and network authentication are ready. */
class IncomingCallActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var uuid: String? = null
  private val checkExpiry = object : Runnable {
    override fun run() {
      val value = NativeCallStore.pending(this@IncomingCallActivity)
      if (value == null || value.callUuid != uuid || value.action == "decline" || value.active) finish()
      else handler.postDelayed(this, 500)
    }
  }

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    showInvitation(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    showInvitation(intent)
  }

  private fun showInvitation(intent: Intent) {
    val id = intent.getStringExtra(NativeCalls.EXTRA_CALL_UUID)
    val value = NativeCallStore.pending(this)?.takeIf { it.callUuid == id && !it.active && it.action != "decline" }
    if (value == null) { finish(); return }
    uuid = value.callUuid
    if (intent.action == NativeCalls.ACTION_ANSWER) {
      NativeCalls.answer(this, value.callUuid)
      finish()
      return
    }
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(48, 48, 48, 48)
      setBackgroundColor(Color.rgb(11, 27, 63))
    }
    layout.addView(TextView(this).apply {
      text = "CallPilot"
      textSize = 34f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    })
    layout.addView(TextView(this).apply {
      text = "Incoming business call"
      textSize = 18f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 64)
    })
    layout.addView(Button(this).apply {
      text = "Answer"
      setTextColor(Color.WHITE)
      setBackgroundColor(Color.rgb(0, 135, 84))
      setOnClickListener { NativeCalls.answer(this@IncomingCallActivity, value.callUuid); finish() }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    layout.addView(Button(this).apply {
      text = "Decline"
      setTextColor(Color.WHITE)
      setBackgroundColor(Color.rgb(190, 40, 55))
      setOnClickListener { NativeCalls.decline(this@IncomingCallActivity, value.callUuid); finish() }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 24 })
    setContentView(layout)
    handler.removeCallbacks(checkExpiry)
    handler.post(checkExpiry)
  }

  override fun onDestroy() {
    handler.removeCallbacks(checkExpiry)
    super.onDestroy()
  }
}
