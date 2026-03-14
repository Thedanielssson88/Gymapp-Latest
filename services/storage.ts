import { supabase } from './supabase';
import { UserProfile, Zone, Exercise, WorkoutSession, BiometricLog, GoalTarget, WorkoutRoutine, ScheduledActivity, RecurringPlan, UserMission, AIProgram } from '../types';
import { DEFAULT_PROFILE } from '../constants';

const ACTIVE_SESSION_KEY = 'morphfit_active_session';
const LOCAL_API_KEY_STORAGE = 'morphfit_gemini_api_key';

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
    // 1. Hämta den aktuella inloggade användaren från Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    
    // Om ingen är inloggad, returnera default
    if (!user) {
      return { id: 'current', ...DEFAULT_PROFILE };
    }

    // 2. Leta efter profilen med användarens unika ID istället för 'current'
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    
    let profile = data as UserProfile | null;
    if (!profile || error) {
      profile = { id: user.id, ...DEFAULT_PROFILE };
    }

    // Tryck in API-nyckeln från LocalStorage innan vi returnerar
    const localApiKey = storage.getLocalApiKey();
    if (localApiKey) {
      profile.settings = { ...profile.settings, geminiApiKey: localApiKey } as any;
    }

    return profile;
  },

  setUserProfile: async (profile: UserProfile) => {
    // 1. Hämta den inloggade användaren
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("Ingen användare är inloggad!");
      return;
    }

    // Klipp ur API-nyckeln innan vi sparar till molnet
    const { settings, ...rest } = profile;
    const { geminiApiKey, ...safeSettings } = settings || {};
    
    if (geminiApiKey !== undefined) {
      storage.setLocalApiKey(geminiApiKey);
    }

    // 2. Sätt id till användarens Supabase-UUID istället för 'current'
    const safeProfile = { ...rest, settings: safeSettings, id: user.id, user_id: user.id };
    
    const { error } = await supabase.from('user_profiles').upsert(safeProfile);

    if (error) {
      console.error("Fel vid sparning av profil i Supabase:", error.message);
      alert("Kunde inte spara profilen: " + error.message);
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

  // --- ZONER ---
  getZones: async (): Promise<Zone[]> => {
    const { data } = await supabase.from('zones').select('*');
    return data || [];
  },
  saveZone: async (zone: Zone) => {
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Admin can save public exercises without user_id, others save with user_id
    const profile = await storage.getUserProfile();
    const isAdmin = (profile as any).is_admin === true;

    const exerciseData = isAdmin && (exercise as any).is_public
      ? { ...exercise, user_id: null, is_public: true }
      : { ...exercise, user_id: user.id, is_public: false };

    await supabase.from('exercises').upsert(exerciseData);
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
  saveRoutine: async (routine: WorkoutRoutine) => await supabase.from('workout_routines').upsert(routine),
  deleteRoutine: async (id: string) => await supabase.from('workout_routines').delete().eq('id', id),

  // Du tillämpar samma mönster för scheduledActivities, recurringPlans, AIPrograms...
  getScheduledActivities: async (): Promise<ScheduledActivity[]> => {
    const { data } = await supabase.from('scheduled_activities').select('*');
    return data || [];
  },
  addScheduledActivity: async (activity: ScheduledActivity) => await supabase.from('scheduled_activities').upsert(activity),
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
    return data || [];
  },
  addRecurringPlan: async (plan: RecurringPlan) => await supabase.from('recurring_plans').upsert(plan),
  deleteRecurringPlan: async (id: string) => await supabase.from('recurring_plans').delete().eq('id', id),
  generateRecurringActivities: async () => {
    // Implementera logik för att generera aktiviteter baserat på rullande schema om det behövs
    console.log("generateRecurringActivities: Not fully implemented yet with Supabase");
  },

  // Missions
  getUserMissions: async (): Promise<UserMission[]> => {
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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
    await supabase.from('ai_programs').delete().eq('id', programId);
    await supabase.from('scheduled_activities').delete().eq('program_id', programId);
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
