import { supabase } from './supabase';
import { UserProfile, Zone, Exercise, WorkoutSession, BiometricLog, GoalTarget, WorkoutRoutine, ScheduledActivity, RecurringPlan, UserMission, AIProgram } from '../types';
import { DEFAULT_PROFILE } from '../constants';
import { encrypt, decrypt } from '../utils/crypto';

const ACTIVE_SESSION_KEY = 'morphfit_active_session';
const LOCAL_API_KEY_STORAGE = 'morphfit_gemini_api_key';
const CACHED_PROFILE_KEY = 'morphfit_cached_profile';

// VIKTIGT: Memory-cache för användarsession (uppdateras av onAuthStateChange)
let cachedSession: any = null;

// Exportera funktion för att sätta cached session (anropas från App.tsx)
export const setCachedSession = (session: any) => {
  cachedSession = session;
};

// Hjälpfunktion för att hämta användare SNABBT (använder memory-cache ELLER localStorage)
const getCurrentUser = () => {
  console.log('🔍 getCurrentUser: cachedSession =', cachedSession);

  // 1. Försök memory-cache först
  if (cachedSession?.user) {
    console.log('✅ getCurrentUser: Hittat i memory-cache');
    return cachedSession.user;
  }

  // 2. Fallback: Läs från Supabase's localStorage-cache (synkront!)
  try {
    // Rätt nyckel baserat på Supabase URL: maviagpzwdjywatckgii
    const item = localStorage.getItem('sb-maviagpzwdjywatckgii-auth-token');
    console.log('🔍 getCurrentUser: localStorage item =', item ? 'FINNS' : 'NULL');
    if (item) {
      const parsed = JSON.parse(item);
      console.log('🔍 getCurrentUser: parsed =', parsed);
      const { currentSession } = parsed;
      if (currentSession?.user) {
        console.log('✅ getCurrentUser: Hittat i localStorage');
        // Uppdatera memory-cache för framtida anrop
        cachedSession = currentSession;
        return currentSession.user;
      }
    }
  } catch (e) {
    console.warn('❌ getCurrentUser: Kunde inte läsa session från localStorage:', e);
  }

  console.warn('⚠️ getCurrentUser: Returnerar NULL!');
  return null;
};

// Hjälpfunktioner för objekt till databas-rader
const snakeToCamel = (obj: any) => {
  // Beroende på din exakta setup med Supabase kan du behöva mappa
  // snake_case från SQL tillbaka till camelCase om du inte använder camelCase i databasen.
  // Med strukturen ovan stämmer namnen väl överens, men håll ett öga på camelCase-namn.
  return obj;
}

export const storage = {
  init: async () => {
    // Här låg tidigare Dexie-migrering. Du kan behålla logik för att 
    // ladda ner initial data om tabellerna är tomma i Supabase.
  },

  // --- API KEY HANTERING (LOKALT) ---
  getLocalApiKey: () => localStorage.getItem(LOCAL_API_KEY_STORAGE) || undefined,
  setLocalApiKey: (key?: string) => {
    if (key) localStorage.setItem(LOCAL_API_KEY_STORAGE, key);
    else localStorage.removeItem(LOCAL_API_KEY_STORAGE);
  },

  // --- PROFIL ---
  getUserProfile: async (): Promise<UserProfile> => {
    // 1. Hämta den aktuella inloggade användaren (SNABB cached version)
    let user = getCurrentUser();

    // Om ingen är inloggad, försök hämta från Supabase direkt (fallback)
    if (!user) {
      console.warn('⚠️ getCurrentUser() returnerade null, hämtar session från Supabase direkt...');
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user || null;

      if (!user) {
        console.warn('⚠️ Ingen session från Supabase heller, returnerar DEFAULT_PROFILE');
        return { id: 'current', ...DEFAULT_PROFILE };
      }

      console.log('✅ Hittade user från Supabase getSession():', user.id);
    }

    // 2. Försök hämta från localStorage-cache FÖRST (instant!)
    try {
      const cached = localStorage.getItem(CACHED_PROFILE_KEY);
      if (cached) {
        const cachedProfile = JSON.parse(cached);
        // Verifiera att det är rätt användare
        if (cachedProfile.id === user.id) {
          console.log(`⚡ getUserProfile: Använder cached profil (instant!)`, cachedProfile);

          // Hämta från Supabase i bakgrunden (för att uppdatera cache + API-nyckel)
          supabase.from('user_profiles').select('*').eq('id', user.id).single().then(async ({ data }) => {
            if (data) {
              console.log('✅ Uppdaterade cached profil från Supabase:', data);
              // Mappa snake_case till camelCase innan cache
              const rawData = data as any;
              const mappedProfile = {
                ...(data as UserProfile),
                biologicalSex: rawData.biological_sex as 'Man' | 'Kvinna' | 'Annan' | undefined
              };
              localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(mappedProfile));

              // Dekryptera och uppdatera API-nyckel om den finns i Supabase
              if ((data as any).encrypted_api_key) {
                try {
                  const decryptedKey = await decrypt((data as any).encrypted_api_key, user.id);
                  storage.setLocalApiKey(decryptedKey);
                  console.log('✅ API-nyckel dekrypterad och sparad i localStorage');
                } catch (e) {
                  console.warn('⚠️ Kunde inte dekryptera API-nyckel:', e);
                }
              }
            }
          });

          // Dekryptera API-nyckel från cache om den finns
          let apiKey = storage.getLocalApiKey(); // Kolla localStorage först

          // Om ingen nyckel i localStorage MEN den finns krypterad i cache → dekryptera den
          if (!apiKey && (cachedProfile as any).encrypted_api_key) {
            try {
              apiKey = await decrypt((cachedProfile as any).encrypted_api_key, user.id);
              storage.setLocalApiKey(apiKey); // Spara i localStorage för snabbare åtkomst
              console.log('✅ API-nyckel dekrypterad från cached profil');
            } catch (e) {
              console.warn('⚠️ Kunde inte dekryptera API-nyckel från cache:', e);
            }
          }

          if (apiKey) {
            cachedProfile.settings = { ...cachedProfile.settings, geminiApiKey: apiKey } as any;
          }

          return cachedProfile;
        }
      }
    } catch (e) {
      console.warn('Kunde inte läsa cached profile:', e);
    }

    // 3. Fallback: Hämta från Supabase (långsamt första gången)
    console.log(`⏱️ getUserProfile: Hämtar profil från Supabase (första gången)...`);
    const startTime = performance.now();
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    console.log(`⏱️ getUserProfile: Supabase query tog ${Math.round(performance.now() - startTime)}ms`);

    let profile = data as UserProfile | null;
    if (!profile || error) {
      profile = { id: user.id, ...DEFAULT_PROFILE };
    } else {
      // Mappa snake_case från Supabase till camelCase
      const rawData = data as any;
      profile = {
        ...profile,
        biologicalSex: rawData.biological_sex as 'Man' | 'Kvinna' | 'Annan' | undefined
      };
    }

    // Spara i cache för nästa gång!
    localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));

    // Dekryptera API-nyckel från Supabase om den finns
    let apiKey = storage.getLocalApiKey(); // Kolla localStorage först

    // Om ingen nyckel i localStorage MEN den finns krypterad i Supabase → dekryptera den
    if (!apiKey && (profile as any).encrypted_api_key) {
      try {
        apiKey = await decrypt((profile as any).encrypted_api_key, user.id);
        storage.setLocalApiKey(apiKey); // Spara i localStorage för snabbare åtkomst
        console.log('✅ API-nyckel dekrypterad från Supabase');
      } catch (e) {
        console.warn('⚠️ Kunde inte dekryptera API-nyckel:', e);
      }
    }

    if (apiKey) {
      profile.settings = { ...profile.settings, geminiApiKey: apiKey } as any;
    }

    return profile;
  },

  setUserProfile: async (profile: UserProfile) => {
    // 1. Hämta den inloggade användaren (SNABB cached version)
    const user = await getCurrentUser();
    if (!user) {
      console.error("Ingen användare är inloggad!");
      return;
    }

    // Klipp ur API-nyckeln och kryptera den
    const { settings, ...rest } = profile;
    let { geminiApiKey, ...safeSettings } = settings || {};

    // Om ingen nyckel finns i settings, försök hämta från localStorage
    if (!geminiApiKey) {
      geminiApiKey = storage.getLocalApiKey();
      console.log('🔍 API-nyckel saknas i settings, hämtar från localStorage:', geminiApiKey ? 'FINNS' : 'SAKNAS');
    }

    // Spara i localStorage för snabb åtkomst
    if (geminiApiKey !== undefined) {
      storage.setLocalApiKey(geminiApiKey);
    }

    // Kryptera API-nyckeln innan den sparas i Supabase
    let encryptedApiKey: string | null = null;
    if (geminiApiKey) {
      try {
        encryptedApiKey = await encrypt(geminiApiKey, user.id);
        console.log('✅ API-nyckel krypterad för Supabase');
      } catch (e) {
        console.error('❌ Kunde inte kryptera API-nyckel:', e);
      }
    } else {
      console.warn('⚠️ Ingen API-nyckel att kryptera (varken i settings eller localStorage)');
    }

    // 2. Sätt id till användarens Supabase-UUID istället för 'current'
    // Ta bort biologicalSex från rest-objektet (annars validerar Supabase mot fel schema)
    const { biologicalSex, ...restWithoutBioSex } = rest;

    const safeProfile = {
      ...restWithoutBioSex,
      settings: safeSettings,
      id: user.id,
      user_id: user.id,
      biological_sex: biologicalSex, // Mappa camelCase till snake_case
      encrypted_api_key: encryptedApiKey // Spara krypterad API-nyckel
    };

    // Använd { count: 'exact' } för att undvika schema-validering
    const { error } = await supabase
      .from('user_profiles')
      .upsert(safeProfile, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error("Fel vid sparning av profil i Supabase:", error.message);
      alert("Kunde inte spara profilen: " + error.message);
    } else {
      console.log('✅ Profil sparad i Supabase (med krypterad API-nyckel)');
      // Uppdatera localStorage-cache efter lyckad sparning
      localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(safeProfile));
    }

    const newLog: BiometricLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString(),
      weight: profile.weight,
      measurements: profile.measurements
    };
    await storage.saveBiometricLog(newLog);
  },

  // --- BIOMETRICS ---
  getBiometricLogs: async (): Promise<BiometricLog[]> => {
    const { data } = await supabase.from('biometric_logs').select('*');
    return data || [];
  },
  
  saveBiometricLog: async (log: BiometricLog) => {
    await supabase.from('biometric_logs').upsert(log);
  },

  deleteBiometricLog: async (logId: string) => {
    const user = getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    console.log('🗑️ Attempting to delete biometric log:', logId, 'for user:', user.id);

    const { data, error } = await supabase
      .from('biometric_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)
      .select();

    if (error) {
      console.error('❌ Error deleting biometric log:', error);
      throw error;
    }

    console.log('✅ Delete result:', data);

    if (!data || data.length === 0) {
      console.warn('⚠️ No rows deleted - log may not exist or user_id mismatch');
      throw new Error('Could not delete log - it may not exist or you do not have permission');
    }
  },

  // --- ZONER ---
  getZones: async (): Promise<Zone[]> => {
    const { data } = await supabase.from('zones').select('*');
    return data || [];
  },
  saveZone: async (zone: Zone) => {
    const user = await getCurrentUser();
    if (!user) return;

    const { error } = await supabase.from('zones').upsert({ ...zone, user_id: user.id });

    if (error) {
      console.error("Fel vid sparning av zon i Supabase:", error.message);
      alert("Kunde inte spara gymmet: " + error.message);
    }
  },
  deleteZone: async (id: string) => await supabase.from('zones').delete().eq('id', id),

  // --- WORKOUT HISTORY ---
  getHistory: async (): Promise<WorkoutSession[]> => {
    const { data } = await supabase.from('workout_history').select('*');
    return data || [];
  },
  saveToHistory: async (session: WorkoutSession) => {
    const user = await getCurrentUser();
    if (!user) {
      console.error("Ingen användare är inloggad!");
      return;
    }

    const completedSession = { 
      ...session, 
      user_id: user.id,
      isCompleted: true, 
      date: session.date || new Date().toISOString(),
      duration: session.duration
    };
    await supabase.from('workout_history').upsert(completedSession);
  },
  deleteWorkoutFromHistory: async (sessionId: string) => {
    await supabase.from('workout_history').delete().eq('id', sessionId);
  },

  // --- ACTIVE SESSION (Kan ligga kvar i LocalStorage för säkerhets skull vid krascher) ---
  getActiveSession: async (): Promise<WorkoutSession | undefined> => {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (raw) {
        try { return JSON.parse(raw) as WorkoutSession; } 
        catch (e) { localStorage.removeItem(ACTIVE_SESSION_KEY); return undefined; }
    }
    return undefined;
  },
  setActiveSession: (session: WorkoutSession | null): void => {
    if (session) localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(ACTIVE_SESSION_KEY);
  },

  // --- EXERCISES ---
  getAllExercises: async (): Promise<Exercise[]> => {
    // Hämta både publika bas-övningar och användarens egna övningar
    const user = await getCurrentUser();

    if (!user) {
      // Om ingen är inloggad, hämta bara publika övningar
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_public', true);
      return data || [];
    }

    // Hämta publika övningar + användarens egna övningar
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*')
      .or(`is_public.eq.true,user_id.eq.${user.id}`);

    return exercises || [];
  },
  saveExercise: async (exercise: Exercise) => {
    console.log('🔵 saveExercise: START', exercise.name);
    const user = await getCurrentUser();
    console.log('🔵 saveExercise: user =', user ? user.id : 'NULL');

    if (!user) {
      console.error('❌ saveExercise: Ingen användare inloggad! Övning sparas INTE till Supabase.');
      alert('⚠️ Ingen användare inloggad! Övning sparas INTE.');
      return;
    }

    // Admin can save public exercises without user_id, others save with user_id
    const profile = await storage.getUserProfile();
    const isAdmin = (profile as any).is_admin === true;
    console.log('🔵 saveExercise: isAdmin =', isAdmin);

    const exerciseData = isAdmin && (exercise as any).is_public
      ? { ...exercise, user_id: null, is_public: true }
      : { ...exercise, user_id: user.id, is_public: false };

    console.log('🔵 saveExercise: Sparar till Supabase...', exerciseData.name);
    const { data, error } = await supabase.from('exercises').upsert(exerciseData).select();

    if (error) {
      console.error('❌ saveExercise: Supabase ERROR:', error);
      alert('❌ Kunde inte spara övning: ' + error.message);
    } else {
      console.log('✅ saveExercise: SUCCESS!', data);
    }
  },
  updateExercise: async (id: string, updates: Partial<Exercise>) => {
    await supabase.from('exercises').update(updates).eq('id', id);
  },
  deleteExercise: async (id: string) => {
    await supabase.from('exercises').delete().eq('id', id);
  },

  // --- RESTERANDE METODER (Mönstret upprepas) ---
  getGoalTargets: async (): Promise<GoalTarget[]> => {
    const { data } = await supabase.from('goal_targets').select('*');
    return data || [];
  },
  saveGoalTarget: async (target: GoalTarget) => await supabase.from('goal_targets').upsert(target),

  getRoutines: async (): Promise<WorkoutRoutine[]> => {
    const { data } = await supabase.from('workout_routines').select('*');
    return data || [];
  },
  saveRoutine: async (routine: WorkoutRoutine) => {
    const user = getCurrentUser(); // Use local function, not storage.getCurrentUser()
    const routineWithUserId = { ...routine, user_id: user?.id };
    return await supabase.from('workout_routines').upsert(routineWithUserId);
  },
  deleteRoutine: async (id: string) => await supabase.from('workout_routines').delete().eq('id', id),

  // Du tillämpar samma mönster för scheduledActivities, recurringPlans, AIPrograms...
  getScheduledActivities: async (): Promise<ScheduledActivity[]> => {
    const { data } = await supabase.from('scheduled_activities').select('*');
    return data || [];
  },
  addScheduledActivity: async (activity: ScheduledActivity) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const activityWithUser = {
      ...activity,
      user_id: user.id
    };

    console.log('💾 Saving scheduled activity to database:', {
      id: activityWithUser.id,
      recurrenceId: activityWithUser.recurrenceId,
      date: activityWithUser.date,
      isCompleted: activityWithUser.isCompleted
    });

    const { error } = await supabase.from('scheduled_activities').upsert(activityWithUser);
    if (error) {
      console.error('❌ Failed to save scheduled activity:', error);
      throw error;
    }
    console.log('✅ Scheduled activity saved successfully');
  },
  updateScheduledActivity: async (id: string, updates: Partial<ScheduledActivity>) => {
    console.log("Updating scheduled activity:", id, updates);
    const { data, error } = await supabase
      .from('scheduled_activities')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error("Fel vid uppdatering av scheduled activity:", error.message, error);
      throw error;
    }

    console.log("Successfully updated scheduled activity:", data);
    return data;
  },
  deleteScheduledActivity: async (id: string) => await supabase.from('scheduled_activities').delete().eq('id', id),

  // Reschedule AI Program - moves all future activities by the same offset
  rescheduleAIProgram: async (programId: string, fromActivityId: string, newDateStr: string): Promise<void> => {
    // Get all activities for this program
    const { data: allActivities } = await supabase
      .from('scheduled_activities')
      .select('*')
      .eq('programId', programId);

    if (!allActivities) return;

    const targetActivity = allActivities.find(a => a.id === fromActivityId);
    if (!targetActivity) return;

    const oldDate = new Date(targetActivity.date);
    const newDate = new Date(newDateStr);

    const diffTime = newDate.getTime() - oldDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return;

    // Update all non-completed activities from the target date onwards
    const updates = allActivities
      .filter(a => !a.isCompleted && new Date(a.date) >= oldDate)
      .map(a => {
        const d = new Date(a.date);
        d.setDate(d.getDate() + diffDays);
        return {
          ...a,
          date: d.toISOString().split('T')[0]
        };
      });

    // Bulk update via upsert
    if (updates.length > 0) {
      for (const activity of updates) {
        await supabase.from('scheduled_activities').upsert(activity);
      }
    }
  },

  // Recurring Plans
  getRecurringPlans: async (): Promise<RecurringPlan[]> => {
    const { data } = await supabase.from('recurring_plans').select('*');
    if (!data) return [];

    // Mappa snake_case (Supabase) till camelCase (TypeScript)
    return data.map(dbPlan => ({
      id: dbPlan.id,
      title: dbPlan.title,
      type: dbPlan.type,
      daysOfWeek: dbPlan.days_of_week,  // snake_case → camelCase
      startDate: dbPlan.start_date,      // snake_case → camelCase
      endDate: dbPlan.end_date,          // snake_case → camelCase
      exercises: dbPlan.exercises,
      color: dbPlan.color                // Färg från databasen
    }));
  },
  addRecurringPlan: async (plan: RecurringPlan) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Mappa camelCase (TypeScript) till snake_case (Supabase)
    const dbPlan = {
      id: plan.id,
      title: plan.title,
      type: plan.type,
      days_of_week: plan.daysOfWeek, // camelCase → snake_case
      start_date: plan.startDate,     // camelCase → snake_case
      end_date: plan.endDate,         // camelCase → snake_case
      exercises: plan.exercises,
      color: plan.color,              // Spara färgen
      user_id: user.id
    };

    const { error } = await supabase.from('recurring_plans').upsert(dbPlan);

    if (error) {
      console.error('Error saving recurring plan:', error);
      throw error;
    }
  },
  updateRecurringPlan: async (id: string, updates: Partial<RecurringPlan>) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Mappa camelCase till snake_case för databas-uppdatering
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.daysOfWeek !== undefined) dbUpdates.days_of_week = updates.daysOfWeek;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.exercises !== undefined) dbUpdates.exercises = updates.exercises;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    console.log("Updating recurring plan:", id, dbUpdates);

    const { data, error } = await supabase
      .from('recurring_plans')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      console.error('Error updating recurring plan:', error);
      throw error;
    }

    console.log("Successfully updated recurring plan:", data);
    return data;
  },
  deleteRecurringPlan: async (id: string) => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('recurring_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting recurring plan:', error);
      throw error;
    }
  },
  generateRecurringActivities: async () => {
    // Implementera logik för att generera aktiviteter baserat på rullande schema om det behövs
    console.log("generateRecurringActivities: Not fully implemented yet with Supabase");
  },

  // Missions
  getUserMissions: async (): Promise<UserMission[]> => {
    const user = await getCurrentUser();
    if (!user) {
      console.log("No user logged in, returning empty missions");
      return [];
    }

    const { data, error } = await supabase
      .from('user_missions')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching user missions:", error);
      return [];
    }

    console.log("Fetched user missions (raw):", data);

    // Convert snake_case to camelCase
    const missions = (data || []).map((dbMission: any) => ({
      id: dbMission.id,
      title: dbMission.title,
      type: dbMission.type,
      isCompleted: dbMission.is_completed ?? false,
      progress: dbMission.progress ?? 0,
      total: dbMission.total ?? 0,
      createdAt: dbMission.created_at,
      completedAt: dbMission.completed_at,
      exerciseId: dbMission.exercise_id,
      smartConfig: dbMission.smart_config
    }));

    console.log("Converted missions:", missions);
    return missions;
  },
  addUserMission: async (mission: UserMission) => {
    const user = await getCurrentUser();
    if (!user) {
      console.error("Ingen användare är inloggad!");
      return;
    }

    // Convert camelCase to snake_case for database
    const dbMission = {
      id: mission.id,
      title: mission.title,
      type: mission.type,
      is_completed: mission.isCompleted,
      progress: mission.progress,
      total: mission.total,
      created_at: mission.createdAt,
      completed_at: mission.completedAt,
      exercise_id: mission.exerciseId,
      smart_config: mission.smartConfig,
      user_id: user.id
    };

    console.log("Saving mission to Supabase:", dbMission);

    const { data, error } = await supabase.from('user_missions').insert(dbMission).select();

    if (error) {
      console.error("Fel vid sparning av mission:", error.message, error);
      throw error;
    }

    console.log("Mission saved successfully:", data);
  },
  updateUserMission: async (mission: UserMission) => {
    // Convert camelCase to snake_case for database
    const dbMission = {
      id: mission.id,
      title: mission.title,
      type: mission.type,
      is_completed: mission.isCompleted,
      progress: mission.progress,
      total: mission.total,
      created_at: mission.createdAt,
      completed_at: mission.completedAt,
      exercise_id: mission.exerciseId,
      smart_config: mission.smartConfig
    };

    const { error } = await supabase.from('user_missions').upsert(dbMission);
    if (error) {
      console.error("Fel vid uppdatering av mission:", error.message, error);
      throw error;
    }
  },
  deleteUserMission: async (id: string) => await supabase.from('user_missions').delete().eq('id', id),

  // För aiPrograms
  getAIPrograms: async (): Promise<AIProgram[]> => {
    const { data } = await supabase.from('ai_programs').select('*');
    return data || [];
  },
  saveAIProgram: async (program: AIProgram): Promise<void> => {
    await supabase.from('ai_programs').upsert(program);
    window.dispatchEvent(new Event('storage-update'));
  },
  deleteAIProgram: async (programId: string): Promise<void> => {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Radera programmet
    const { error: programError } = await supabase
      .from('ai_programs')
      .delete()
      .eq('id', programId)
      .eq('user_id', user.id);

    if (programError) {
      console.error('Error deleting AI program:', programError);
      throw programError;
    }

    // Radera alla tillhörande schemalagda aktiviteter
    const { error: activitiesError } = await supabase
      .from('scheduled_activities')
      .delete()
      .eq('program_id', programId)
      .eq('user_id', user.id);

    if (activitiesError) {
      console.error('Error deleting program activities:', activitiesError);
      throw activitiesError;
    }

    window.dispatchEvent(new Event('storage-update'));
  }
};

export const exportExerciseLibrary = async (): Promise<boolean> => {
  try {
    const { data: allExercises } = await supabase.from('exercises').select('*');
    if (!allExercises) return false;
    
    const libraryData = {
      type: 'GYM_APP_EXERCISE_LIBRARY',
      version: 1,
      exportDate: new Date().toISOString(),
      count: allExercises.length,
      exercises: allExercises
    };

    // Skapa en nedladdningslänk i webbläsaren
    const jsonString = JSON.stringify(libraryData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exercise-library-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Export of library failed:", error);
    return false;
  }
};

export const importExerciseLibrary = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        
        if (content.type !== 'GYM_APP_EXERCISE_LIBRARY' || !Array.isArray(content.exercises)) {
          throw new Error("Felaktigt filformat. Detta är inte en giltig biblioteksfil.");
        }

        // Skicka in hela listan med övningar till Supabase
        const { error } = await supabase.from('exercises').upsert(content.exercises);
        if (error) throw error;

        resolve(content.exercises.length);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};
