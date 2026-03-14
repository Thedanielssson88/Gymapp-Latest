import { db } from './db';
import { storage } from './storage';
import { supabase } from './supabase';

const MIGRATION_FLAG_KEY = 'morphfit_supabase_migrated';

/**
 * Kontrollera om migrering till Supabase redan har genomförts
 */
export const isMigrationCompleted = (): boolean => {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
};

/**
 * Markera migrering som slutförd
 */
const setMigrationCompleted = () => {
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
};

/**
 * Huvudfunktion: Migrera all data från Dexie/IndexedDB till Supabase
 * Körs automatiskt första gången användaren loggar in på Supabase
 */
export const migrateToSupabase = async (): Promise<{
  success: boolean;
  message: string;
  stats?: {
    profile: boolean;
    zones: number;
    exercises: number;
    history: number;
    biometricLogs: number;
    routines: number;
    missions: number;
    goalTargets: number;
  };
}> => {
  console.log("🔄 Startar migrering från IndexedDB till Supabase...");

  try {
    // Kontrollera att användaren är inloggad
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        message: "Ingen användare inloggad - kan inte migrera data"
      };
    }

    // Hämta befintlig data från Supabase för att se om det redan finns data
    const existingData = await Promise.all([
      storage.getZones(),
      storage.getHistory(),
      storage.getBiometricLogs()
    ]);

    const hasExistingData = existingData.some(data => data.length > 0);

    if (hasExistingData) {
      console.log("⚠️ Data finns redan i Supabase - skippar migrering");
      setMigrationCompleted();
      return {
        success: true,
        message: "Data finns redan i Supabase - ingen migrering behövdes"
      };
    }

    // Hämta all data från IndexedDB/Dexie
    console.log("📦 Hämtar data från lokal databas...");

    const localProfile = await db.userProfile.get('current');
    const localZones = await db.zones.toArray();
    const localExercises = await db.exercises.toArray();
    const localHistory = await db.workoutHistory.toArray();
    const localBiometricLogs = await db.biometricLogs.toArray();
    const localRoutines = await db.workoutRoutines.toArray();
    const localMissions = await db.userMissions.toArray();
    const localGoalTargets = await db.goalTargets.toArray();

    // Räkna total data
    const totalItems =
      (localProfile ? 1 : 0) +
      localZones.length +
      localExercises.length +
      localHistory.length +
      localBiometricLogs.length +
      localRoutines.length +
      localMissions.length +
      localGoalTargets.length;

    if (totalItems === 0) {
      console.log("ℹ️ Ingen lokal data att migrera");
      setMigrationCompleted();
      return {
        success: true,
        message: "Ingen lokal data hittades - ingen migrering behövdes"
      };
    }

    console.log(`📊 Hittat ${totalItems} objekt att migrera`);

    // Migrera data till Supabase
    const stats = {
      profile: false,
      zones: 0,
      exercises: 0,
      history: 0,
      biometricLogs: 0,
      routines: 0,
      missions: 0,
      goalTargets: 0
    };

    // 1. Migrera profil
    if (localProfile && localProfile.name !== "Atlet") {
      console.log("👤 Migrerar profil...");
      try {
        await storage.setUserProfile(localProfile);
        stats.profile = true;
      } catch (error) {
        console.error("Fel vid migrering av profil:", error);
      }
    }

    // 2. Migrera zoner
    if (localZones.length > 0) {
      console.log(`🏋️ Migrerar ${localZones.length} zoner...`);
      for (const zone of localZones) {
        try {
          await storage.saveZone(zone);
          stats.zones++;
        } catch (error) {
          console.error(`Fel vid migrering av zon ${zone.id}:`, error);
        }
      }
    }

    // 3. Migrera egna övningar (skippa publika bas-övningar)
    if (localExercises.length > 0) {
      console.log(`💪 Migrerar användarmodifierade övningar...`);
      for (const exercise of localExercises) {
        // Migrera endast övningar som användaren skapat eller modifierat
        if (exercise.userModified || exercise.image || exercise.userRating) {
          try {
            await storage.saveExercise(exercise);
            stats.exercises++;
          } catch (error) {
            console.error(`Fel vid migrering av övning ${exercise.id}:`, error);
          }
        }
      }
    }

    // 4. Migrera träningspass
    if (localHistory.length > 0) {
      console.log(`📝 Migrerar ${localHistory.length} träningspass...`);
      for (const session of localHistory) {
        try {
          await storage.saveWorkoutSession(session);
          stats.history++;
        } catch (error) {
          console.error(`Fel vid migrering av träningspass ${session.id}:`, error);
        }
      }
    }

    // 5. Migrera biometriska mätningar
    if (localBiometricLogs.length > 0) {
      console.log(`📊 Migrerar ${localBiometricLogs.length} mätningar...`);
      for (const log of localBiometricLogs) {
        try {
          await storage.saveBiometricLog(log);
          stats.biometricLogs++;
        } catch (error) {
          console.error(`Fel vid migrering av mätning ${log.id}:`, error);
        }
      }
    }

    // 6. Migrera rutiner
    if (localRoutines.length > 0) {
      console.log(`📋 Migrerar ${localRoutines.length} rutiner...`);
      for (const routine of localRoutines) {
        try {
          await storage.saveRoutine(routine);
          stats.routines++;
        } catch (error) {
          console.error(`Fel vid migrering av rutin ${routine.id}:`, error);
        }
      }
    }

    // 7. Migrera missions
    if (localMissions.length > 0) {
      console.log(`🎯 Migrerar ${localMissions.length} mål...`);
      for (const mission of localMissions) {
        try {
          await storage.addUserMission(mission);
          stats.missions++;
        } catch (error) {
          console.error(`Fel vid migrering av mål ${mission.id}:`, error);
        }
      }
    }

    // 8. Migrera goal targets
    if (localGoalTargets.length > 0) {
      console.log(`🎯 Migrerar ${localGoalTargets.length} goal targets...`);
      for (const target of localGoalTargets) {
        try {
          await storage.saveGoalTarget(target);
          stats.goalTargets++;
        } catch (error) {
          console.error(`Fel vid migrering av goal target ${target.id}:`, error);
        }
      }
    }

    // Markera migrering som klar
    setMigrationCompleted();

    console.log("✅ Migrering klar!");
    console.log("📊 Statistik:", stats);

    return {
      success: true,
      message: `Migrering klar! ${totalItems} objekt flyttade till Supabase.`,
      stats
    };

  } catch (error) {
    console.error("❌ Fel vid migrering till Supabase:", error);
    return {
      success: false,
      message: `Migreringsfel: ${(error as Error).message}`
    };
  }
};

/**
 * Automatisk migrering som körs när appen startar
 * Kontrollerar om användaren är inloggad och om migrering behövs
 */
export const autoMigrateOnStartup = async (): Promise<void> => {
  // Kontrollera om migrering redan gjorts
  if (isMigrationCompleted()) {
    console.log("ℹ️ Migrering redan genomförd");
    return;
  }

  // Kontrollera om användaren är inloggad
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("ℹ️ Ingen användare inloggad - väntar med migrering");
    return;
  }

  console.log("🚀 Användare inloggad - startar automatisk migrering...");

  // Kör migrering
  const result = await migrateToSupabase();

  if (result.success && result.stats) {
    // Visa meddelande till användaren om vad som migrerades
    const migrated = [];
    if (result.stats.profile) migrated.push("profil");
    if (result.stats.zones > 0) migrated.push(`${result.stats.zones} zoner`);
    if (result.stats.history > 0) migrated.push(`${result.stats.history} träningspass`);
    if (result.stats.biometricLogs > 0) migrated.push(`${result.stats.biometricLogs} mätningar`);
    if (result.stats.exercises > 0) migrated.push(`${result.stats.exercises} övningar`);
    if (result.stats.routines > 0) migrated.push(`${result.stats.routines} rutiner`);
    if (result.stats.missions > 0) migrated.push(`${result.stats.missions} mål`);

    if (migrated.length > 0) {
      console.log(`✅ Migrerade: ${migrated.join(", ")}`);

      // Visa ett vänligt meddelande till användaren
      alert(`🎉 Välkommen!\n\nDin lokala data har flyttats till molnet:\n${migrated.join("\n")}\n\nDin träningshistorik är nu säkrad och tillgänglig från alla enheter!`);
    }
  }
};
