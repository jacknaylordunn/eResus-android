package uk.co.aegismedicalsolutions.eresus.services

import android.content.Context
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import uk.co.aegismedicalsolutions.eresus.R
import uk.co.aegismedicalsolutions.eresus.models.AppSettings
import kotlin.math.max

// MARK: - Time Formatter
object TimeFormatter {
    fun format(timeInterval: Double): String {
        val time = max(0.0, timeInterval).toInt()
        val minutes = time / 60
        val seconds = time % 60
        return String.format("%02d:%02d", minutes, seconds)
    }
}

// MARK: - Haptic Manager
class HapticManager(context: Context) {
    private val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        vibratorManager.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    fun impact(light: Boolean = true) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val effect = VibrationEffect.createPredefined(
                if (light) VibrationEffect.EFFECT_TICK else VibrationEffect.EFFECT_CLICK
            )
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(if (light) 20 else 40)
        }
    }
}


// MARK: - Metronome
class Metronome(context: Context) {
    private val _isMetronomeOn = MutableStateFlow(false)
    val isMetronomeOn = _isMetronomeOn.asStateFlow()

    private var metronomeJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Default)
    private var mediaPlayer: MediaPlayer? = MediaPlayer.create(context, R.raw.metronome_tick)

    fun toggle() {
        _isMetronomeOn.value = !_isMetronomeOn.value
        if (_isMetronomeOn.value) {
            start()
        } else {
            stop()
        }
    }

    private fun start() {
        stop()
        val interval = 60_000L / AppSettings.metronomeBPM
        metronomeJob = scope.launch {
            while (true) {
                mediaPlayer?.start()
                delay(interval)
            }
        }
    }

    private fun stop() {
        metronomeJob?.cancel()
        metronomeJob = null
    }

    fun release() {
        mediaPlayer?.release()
        mediaPlayer = null
    }
}
