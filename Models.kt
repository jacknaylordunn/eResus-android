package uk.co.aegismedicalsolutions.eresus.models

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Relation
import androidx.compose.ui.graphics.Color
import java.util.UUID

// MARK: - Database Models (Room Entities)

@Entity(tableName = "arrest_logs")
data class SavedArrestLog(
    @PrimaryKey val startTime: Long,
    val totalDuration: Double,
    val finalOutcome: String
)

@Entity(tableName = "events")
data class Event(
    @PrimaryKey val id: UUID = UUID.randomUUID(),
    val logStartTime: Long, // Foreign key to SavedArrestLog
    val timestamp: Double,
    val message: String,
    val typeString: String
) {
    val type: EventType
        get() = EventType.valueOf(typeString)
}

// Represents the relationship between a log and its events
data class LogWithEvents(
    @androidx.room.Embedded val log: SavedArrestLog,
    @Relation(
        parentColumn = "startTime",
        entityColumn = "logStartTime"
    )
    val events: List<Event>
)

// MARK: - App State Enums
enum class ArrestState(val color: Color) {
    PENDING(Color.Gray),
    ACTIVE(Color.Red),
    ROSC(Color.Green),
    ENDED(Color.Black)
}

enum class EventType(val color: Color) {
    STATUS(Color(0xFF4CAF50)), // Green
    CPR(Color(0xFF00BCD4)),    // Cyan
    SHOCK(Color(0xFFFF9800)),  // Orange
    ANALYSIS(Color(0xFF2196F3)),// Blue
    RHYTHM(Color(0xFF9C27B0)), // Purple
    DRUG(Color(0xFFE91E63)),   // Pink
    AIRWAY(Color(0xFF009688)),  // Teal
    ETCO2(Color(0xFF3F51B5)),  // Indigo
    CAUSE(Color.Gray)
}

enum class UIState {
    DEFAULT, ANALYZING, SHOCK_ADVISED
}

enum class AntiarrhythmicDrug {
    NONE, AMIODARONE, LIDOCAINE
}

enum class HypothermiaStatus {
    NONE, SEVERE, MODERATE, NORMOTHERMIC
}

enum class AppearanceMode(val displayName: String) {
    SYSTEM("System"),
    LIGHT("Light"),
    DARK("Dark")
}

sealed class DrugToLog(val title: String) {
    object Adrenaline : DrugToLog("Adrenaline")
    object Amiodarone : DrugToLog("Amiodarone")
    object Lidocaine : DrugToLog("Lidocaine")
    data class Other(val name: String) : DrugToLog(name)
}

// MARK: - UI & Data Structs
data class ChecklistItem(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    var isCompleted: Boolean = false,
    var hypothermiaStatus: HypothermiaStatus = HypothermiaStatus.NONE
)

data class PDFIdentifiable(
    val id: UUID = UUID.randomUUID(),
    val pdfName: String,
    val title: String
)

// MARK: - App Constants & Settings

// In a real Android app, these would be managed by Jetpack DataStore or SharedPreferences
object AppSettings {
    var cprCycleDuration: Double = 120.0
    var adrenalineInterval: Double = 240.0
    var metronomeBPM: Int = 110
    var appearanceMode: AppearanceMode = AppearanceMode.SYSTEM
    var showDosagePrompts: Boolean = false
}

object AppConstants {
    val reversibleCausesTemplate: List<ChecklistItem> = listOf(
        ChecklistItem(name = "Hypoxia"), ChecklistItem(name = "Hypovolemia"),
        ChecklistItem(name = "Hypo/Hyperkalaemia"), ChecklistItem(name = "Hypothermia"),
        ChecklistItem(name = "Toxins"), ChecklistItem(name = "Tamponade"),
        ChecklistItem(name = "Tension Pneumothorax"), ChecklistItem(name = "Thrombosis")
    )

    val postROSCTasksTemplate: List<ChecklistItem> = listOf(
        ChecklistItem(name = "Optimise Ventilation & Oxygenation"), ChecklistItem(name = "12-Lead ECG"),
        ChecklistItem(name = "Treat Hypotension (SBP < 90)"), ChecklistItem(name = "Check Blood Glucose"),
        ChecklistItem(name = "Consider Temperature Control"), ChecklistItem(name = "Identify & Treat Causes")
    )

    val postMortemTasksTemplate: List<ChecklistItem> = listOf(
        ChecklistItem(name = "Reposition body & remove lines/tubes"), ChecklistItem(name = "Complete documentation"),
        ChecklistItem(name = "Determine expected/unexpected death"), ChecklistItem(name = "Contact Coroner (if unexpected)"),
        ChecklistItem(name = "Follow local body handling procedure"), ChecklistItem(name = "Provide leaflet to bereaved relatives"),
        ChecklistItem(name = "Consider organ/tissue donation")
    )

    val otherDrugs: List<String> = listOf(
        "Adenosine", "Adrenaline 1:1000", "Adrenaline 1:10,000", "Amiodarone (Further Dose)",
        "Atropine", "Calcium chloride", "Glucose", "Hartmann’s solution", "Magnesium sulphate",
        "Midazolam", "Naloxone", "Potassium chloride", "Sodium bicarbonate", "Sodium chloride", "Tranexamic acid"
    ).sorted()
}
