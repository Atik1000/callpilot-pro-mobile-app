package expo.modules.callpilotkeepalive

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Loud incoming-call ringer. Plays the phone's ringtone on the ring stream at
 * the user's configured volume with repeating vibration. It respects the
 * phone's Silent / Vibrate switch: silent means no sound, and vibrate means
 * vibration only.
 */
object Ringer {
  private const val MAX_RING_MS = 60_000L
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stopInternal() }

  @Synchronized
  fun start(context: Context) {
    if (player != null || vibrator != null) return
    val app = context.applicationContext
    val audio = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val mode = audio.ringerMode

    if (mode == AudioManager.RINGER_MODE_NORMAL) {
      val uri = RingtoneManager.getActualDefaultRingtoneUri(app, RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      try {
        player = MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          setDataSource(app, uri)
          isLooping = true
          setVolume(1f, 1f)
          prepare()
          start()
        }
      } catch (_: Exception) {
        player?.release()
        player = null
      }
    }

    if (mode != AudioManager.RINGER_MODE_SILENT) {
      vibrator = vibratorOf(app)?.also { v ->
        val pattern = longArrayOf(0, 1000, 800)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          v.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
          @Suppress("DEPRECATION")
          v.vibrate(pattern, 0)
        }
      }
    }

    handler.removeCallbacks(autoStop)
    handler.postDelayed(autoStop, MAX_RING_MS)
  }

  @Synchronized
  fun stop() = stopInternal()


  @Synchronized
  private fun stopInternal() {
    handler.removeCallbacks(autoStop)
    player?.let {
      try { it.stop() } catch (_: Exception) {}
      it.release()
    }
    player = null
    vibrator?.cancel()
    vibrator = null

  }

  private fun vibratorOf(context: Context): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
}
