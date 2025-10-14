package uk.co.aegismedicalsolutions.eresus.database

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow
import java.util.Date

// Type converters to allow Room to store complex types like Date
class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }
}

// Data Access Object (DAO)
@Dao
interface ArrestDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: SavedArrestLog)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<Event>)

    @Transaction
    @Query("SELECT * FROM arrest_logs ORDER BY startTime DESC")
    fun getAllLogsWithEvents(): Flow<List<LogWithEvents>>

    @Delete
    suspend fun deleteLog(log: SavedArrestLog)
}

// The main database class
@Database(entities = [SavedArrestLog::class, Event::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun arrestDao(): ArrestDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "eresus_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
