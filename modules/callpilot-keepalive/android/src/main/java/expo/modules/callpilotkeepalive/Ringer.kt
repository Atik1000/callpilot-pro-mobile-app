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
 * full volume (restored afterwards) with repeating vibration. It respects the
 * phone's Silent / Vibrate switch: silent means no sound, and vibrate means
 * vibration only.
 */
object Ringer {
  private const val MAX_RING_MS = 70_000L
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var savedVolume: Int? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stopInternal() }

  /** Rings until stopped, or for at most `maxMs` (the invitation's remaining time). */
  @Synchronized
  fun start(context: Context, maxMs: Long = MAX_RING_MS) {
    if (player != null || vibrator != null) return
    val app = context.applicationContext
    val audio = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val mode = audio.ringerMode

    if (mode == AudioManager.RINGER_MODE_NORMAL) {
      try {
        savedVolume = audio.getStreamVolume(AudioManager.STREAM_RING)
        audio.setStreamVolume(AudioManager.STREAM_RING, audio.getStreamMaxVolume(AudioManager.STREAM_RING), 0)
      } catch (_: Exception) {
        // Do Not Disturb can block volume changes; ring at the current volume.
        savedVolume = null
      }
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
    handler.postDelayed(autoStop, maxMs.coerceIn(1_000L, MAX_RING_MS))
    appContext = app
  }

  @Synchronized
  fun stop() = stopInternal()

  @Synchronized
  fun isRinging(): Boolean = player != null || vibrator != null

  private var appContext: Context? = null

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
    val ctx = appContext
    val volume = savedVolume
    if (ctx != null && volume != null) {
      try {
        (ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager)
          .setStreamVolume(AudioManager.STREAM_RING, volume, 0)
      } catch (_: Exception) {}
    }
    savedVolume = null
  }

  private fun vibratorOf(context: Context): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
}
