
import Dexie, { type Table } from 'dexie';
import { 
  UserProfile, Zone, Exercise, WorkoutSession, BiometricLog, 
  GoalTarget, WorkoutRoutine, ScheduledActivity, RecurringPlan, UserMission, AIProgram
} from '../types';
import { INITIAL_EXERCISES } from '../data/initialExercises';
import { INITIAL_ZONES, INITIAL_GOAL_TARGETS, DEFAULT_PROFILE } from '../constants';

export class GymDatabase extends Dexie {
  userProfile!: Table<UserProfile, string>; 
  zones!: Table<Zone, string>;
  exercises!: Table<Exercise, string>;
  workoutHistory!: Table<WorkoutSession, string>;
  biometricLogs!: Table<BiometricLog, string>;
  goalTargets!: Table<GoalTarget, string>;
  workoutRoutines!: Table<WorkoutRoutine, string>;
  scheduledActivities!: Table<ScheduledActivity, string>;
  recurringPlans!: Table<RecurringPlan, string>;
  userMissions!: Table<UserMission, string>;
  aiPrograms!: Table<AIProgram, string>;

  constructor() {
    super('MorphFitDB');
    
    (this as Dexie).version(7).stores({
      userProfile: 'id',
      zones: 'id',
      exercises: 'id, name, muscleGroups',
      workoutHistory: 'id, date',
      biometricLogs: 'id, date',
      goalTargets: 'id',
      workoutRoutines: 'id',
      scheduledActivities: 'id, date, type, recurrenceId, programId',
      recurringPlans: 'id',
      userMissions: 'id, type, isCompleted, exerciseId',
      aiPrograms: 'id, status'
    });

    (this as Dexie).on('populate', async () => {
      await this.exercises.bulkAdd(INITIAL_EXERCISES);
      await this.zones.bulkAdd(INITIAL_ZONES);
      await this.goalTargets.bulkAdd(INITIAL_GOAL_TARGETS);
      await this.userProfile.put({ id: 'current', ...DEFAULT_PROFILE });
    });
  }

  async syncExercises() {
    try {
      // 1. Hämta befintliga övningar från databasen för att inte tappa användardata (bilder, betyg, score)
      const existingExercises = await this.exercises.toArray();
      const existingMap = new Map<string, Exercise>(existingExercises.map(e => [e.id, e]));

      // 2. Skapa en sammanslagen lista
      const mergedExercises = INITIAL_EXERCISES.map(initEx => {
        const saved = existingMap.get(initEx.id);
        if (saved) {
          // Explicit merge för att garantera att vi inte tappar bilder
          return {
            ...initEx, // Grunddata från kod (namn, beskrivning etc)
            
            // Kritisk användardata som måste bevaras
            image: saved.image || initEx.image, 
            score: saved.score ?? initEx.score,
            userRating: saved.userRating ?? initEx.userRating,
            userModified: saved.userModified ?? initEx.userModified,
            trackingType: saved.trackingType ?? initEx.trackingType,
            
            // Bevara ev. ändringar i utrustning eller muskler om användaren redigerat
            equipment: saved.userModified ? (saved.equipment || initEx.equipment) : initEx.equipment,
            primaryMuscles: saved.userModified ? (saved.primaryMuscles || initEx.primaryMuscles) : initEx.primaryMuscles
          };
        }
        return initEx;
      });

      // 3. Spara ner den sammanslagna listan
      await this.exercises.bulkPut(mergedExercises);
      console.log("Övningsbiblioteket har synkroniserats (Bilder & Data bevarad)!");
    } catch (error) {
      console.error("Fel vid synkronisering av övningar:", error);
    }
  }
}

export const db = new GymDatabase();

export const migrateFromLocalStorage = async () => {
  const ALREADY_MIGRATED_KEY = 'morphfit_db_migrated';
  if (localStorage.getItem(ALREADY_MIGRATED_KEY)) return;

  console.log("Startar migrering till IndexedDB...");

  const tables = [
    { key: 'db_table_user_profile', table: db.userProfile },
    { key: 'db_table_zones', table: db.zones },
    { key: 'db_table_exercises', table: db.exercises },
    { key: 'db_table_workout_history', table: db.workoutHistory },
    { key: 'db_table_biometric_logs', table: db.biometricLogs },
    { key: 'db_table_goal_targets', table: db.goalTargets },
    { key: 'db_table_workout_routines', table: db.workoutRoutines },
  ];

  try {
    // @ts-ignore
    await (db as Dexie).transaction('rw', db.userProfile, db.zones, db.exercises, db.workoutHistory, db.biometricLogs, db.goalTargets, db.workoutRoutines, async () => {
      for (const { key, table } of tables) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
              await table.bulkPut(data);
            } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
              await table.put(data);
            }
          } catch (e) {
            console.error(`Fel vid migrering av ${key}`, e);
          }
        }
      }
    });

    localStorage.setItem(ALREADY_MIGRATED_KEY, 'true');
    console.log("Migrering klar!");
  } catch(e) {
    console.error("Allvarligt fel under databasmigrering: ", e);
  }
};

/**
 * Exportera hela databasen till JSON
 */
export const exportDatabase = async () => {
  const profile = await db.userProfile.get('current') || { ...DEFAULT_PROFILE, id: 'current' };
  const allTables = {
    profile,
    history: await db.workoutHistory.toArray(),
    zones: await db.zones.toArray(),
    exercises: await db.exercises.toArray(),
    routines: await db.workoutRoutines.toArray(),
    biometricLogs: await db.biometricLogs.toArray(),
    missions: await db.userMissions.toArray(),
    goalTargets: await db.goalTargets.toArray(),
  };
  return {
    ...allTables,
    version: 1
  };
};

/**
 * Importera och skriv över databasen
 */
export const importDatabase = async (data: any) => {
  const tablesToClear = [
    db.userProfile, db.zones, db.exercises, db.workoutHistory,
    db.biometricLogs, db.workoutRoutines, db.userMissions, db.goalTargets
  ];
  // FIX: Cast db to Dexie to access the transaction method.
  return (db as Dexie).transaction('rw', tablesToClear, async () => {
    for (const table of tablesToClear) {
      await table.clear();
    }
    
    if (data.profile) await db.userProfile.put(data.profile);
    if (data.zones) await db.zones.bulkPut(data.zones);
    if (data.exercises) await db.exercises.bulkPut(data.exercises);
    if (data.history) await db.workoutHistory.bulkPut(data.history);
    if (data.biometricLogs) await db.biometricLogs.bulkPut(data.biometricLogs);
    if (data.routines) await db.workoutRoutines.bulkPut(data.routines);
    if (data.missions) await db.userMissions.bulkPut(data.missions);
    if (data.goalTargets) await db.goalTargets.bulkPut(data.goalTargets);
  });
};
