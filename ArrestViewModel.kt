package uk.co.aegismedicalsolutions.eresus.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import uk.co.aegismedicalsolutions.eresus.models.*
import uk.co.aegismedicalsolutions.eresus.services.PatientAgeCategory
import java.util.Date

class ArrestViewModel : ViewModel() {

    // MARK: - State Properties
    private val _arrestState = MutableStateFlow(ArrestState.PENDING)
    val arrestState = _arrestState.asStateFlow()

    private val _masterTime = MutableStateFlow(0.0)
    val masterTime = _masterTime.asStateFlow()

    private val _cprTime = MutableStateFlow(AppSettings.cprCycleDuration)
    val cprTime = _cprTime.asStateFlow()

    private val _timeOffset = MutableStateFlow(0.0)
    val timeOffset = _timeOffset.asStateFlow()
    
    private val _uiState = MutableStateFlow(UIState.DEFAULT)
    val uiState = _uiState.asStateFlow()

    private val _events = MutableStateFlow<List<Event>>(emptyList())
    val events = _events.asStateFlow()

    // ... other state flows for shockCount, adrenalineCount, etc.
    private val _shockCount = MutableStateFlow(0)
    val shockCount = _shockCount.asStateFlow()

    private val _adrenalineCount = MutableStateFlow(0)
    val adrenalineCount = _adrenalineCount.asStateFlow()
    
    // ... continue for amiodarone, lidocaine, airwayPlaced etc.

    // MARK: - Private State
    private var timerJob: Job? = null
    private var startTime: Date? = null
    private var cprCycleStartTime: Double = 0.0
    private var lastAdrenalineTime: Double? = null
    // ... other private properties

    // MARK: - Core Timer Logic
    private fun startTimer() {
        stopTimer()
        cprCycleStartTime = totalArrestTime
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                tick()
            }
        }
    }
    
    fun stopTimer() {
        timerJob?.cancel()
        timerJob = null
    }
    
    private fun tick() {
        val st = startTime ?: return
        _masterTime.value = (Date().time - st.time) / 1000.0

        if (_arrestState.value == ArrestState.ACTIVE && _uiState.value == UIState.DEFAULT) {
            val oldCprTime = _cprTime.value
            _cprTime.value = AppSettings.cprCycleDuration - (totalArrestTime - cprCycleStartTime)

            if (_cprTime.value <= 0 && oldCprTime > 0) {
                // Haptic feedback would be triggered here
            }

            if (_cprTime.value < -0.9) {
                cprCycleStartTime = totalArrestTime
                _cprTime.value = AppSettings.cprCycleDuration
            }
        }
    }

    val totalArrestTime: Double
        get() = _masterTime.value + _timeOffset.value

    // MARK: - User Actions
    fun startArrest() {
        startTime = Date()
        _arrestState.value = ArrestState.ACTIVE
        logEvent("Arrest Started at ${Date()}", EventType.STATUS)
        startTimer()
    }

    fun analyseRhythm() {
        _uiState.value = UIState.ANALYZING
        logEvent("Rhythm analysis. Pausing CPR.", EventType.ANALYSIS)
    }

    fun logRhythm(rhythm: String, isShockable: Boolean) {
        logEvent("Rhythm is $rhythm", EventType.RHYTHM)
        if (isShockable) {
            _uiState.value = UIState.SHOCK_ADVISED
        } else {
            resumeCPR()
        }
    }
    
    fun deliverShock() {
        _shockCount.update { it + 1 }
        logEvent("Shock ${_shockCount.value} Delivered", EventType.SHOCK)
        resumeCPR()
    }

    private fun resumeCPR() {
        _uiState.value = UIState.DEFAULT
        cprCycleStartTime = totalArrestTime
        _cprTime.value = AppSettings.cprCycleDuration
        logEvent("Resuming CPR.", EventType.CPR)
    }

    fun logAdrenaline(withDosage: String? = null) {
        _adrenalineCount.update { it + 1 }
        lastAdrenalineTime = totalArrestTime
        val dosageText = if(AppSettings.showDosagePrompts && withDosage != null) " ($withDosage)" else ""
        logEvent("Adrenaline$dosageText Given - Dose ${_adrenalineCount.value}", EventType.DRUG)
    }

    // ... other actions like logAmiodarone, achieveROSC, endArrest, etc.

    fun setPatientAgeCategory(ageCategory: PatientAgeCategory?) {
        // Store this in a state flow if needed
    }

    private fun logEvent(message: String, type: EventType) {
        val newEvent = Event(
            logStartTime = startTime?.time ?: 0L,
            timestamp = totalArrestTime,
            message = message,
            typeString = type.name
        )
        _events.update { listOf(newEvent) + it }
        // Haptic feedback would be triggered here
    }
    
    fun performReset(shouldSaveLog: Boolean, shouldCopy: Boolean) {
        if (shouldSaveLog && startTime != null) {
            // saveLogToDatabase() - would interact with Room DAO here
        }
        if (shouldCopy) {
            // copySummaryToClipboard()
        }

        stopTimer()
        _arrestState.value = ArrestState.PENDING
        _masterTime.value = 0.0
        //... reset all other states
        _events.value = emptyList()
        _shockCount.value = 0
        // etc.
    }
}
