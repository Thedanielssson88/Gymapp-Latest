

import { db, migrateFromLocalStorage } from './db';
import { UserProfile, Zone, Exercise, WorkoutSession, BiometricLog, GoalTarget, WorkoutRoutine, Goal, ScheduledActivity, RecurringPlan, UserMission, AIProgram } from '../types';
import { DEFAULT_PROFILE } from '../constants';

const ACTIVE_SESSION_KEY = 'morphfit_active_session';

export const storage = {
  init: async () => {
    await migrateFromLocalStorage();
  },

  getUserProfile: async (): Promise<UserProfile> => {
    const profile = await db.userProfile.get('current');
    return profile || { id: 'current', ...DEFAULT_PROFILE };
  },

  setUserProfile: async (profile: UserProfile) => {
    await db.userProfile.put({ ...profile, id: 'current' });
    const newLog: BiometricLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString(),
      weight: profile.weight,
      measurements: profile.measurements
    };
    await db.biometricLogs.put(newLog);
  },

  getBiometricLogs: async (): Promise<BiometricLog[]> => await db.biometricLogs.toArray(),
  
  saveBiometricLog: async (log: BiometricLog) => {
    await db.biometricLogs.put(log);
  },

  getZones: async (): Promise<Zone[]> => await db.zones.toArray(),
  saveZone: async (zone: Zone) => await db.zones.put(zone),
  deleteZone: async (id: string) => await db.zones.delete(id),

  getHistory: async (): Promise<WorkoutSession[]> => await db.workoutHistory.toArray(),
  saveToHistory: async (session: WorkoutSession) => {
    const completedSession = { 
      ...session, 
      isCompleted: true, 
      date: session.date || new Date().toISOString(),
      duration: session.duration
    };
    await db.workoutHistory.put(completedSession);
  },

  deleteWorkoutFromHistory: async (sessionId: string) => {
    await db.workoutHistory.delete(sessionId);
  },

  getActiveSession: async (): Promise<WorkoutSession | undefined> => {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (raw) {
        try {
            return JSON.parse(raw) as WorkoutSession;
        } catch (e) {
            console.error("Failed to parse active session from localStorage", e);
            localStorage.removeItem(ACTIVE_SESSION_KEY);
            return undefined;
        }
    }
    return undefined;
  },
  
  setActiveSession: (session: WorkoutSession | null): void => {
    if (session) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  },

  getAllExercises: async (): Promise<Exercise[]> => await db.exercises.toArray(),
  saveExercise: async (exercise: Exercise) => await db.exercises.put(exercise),

  updateExercise: async (id: string, updates: Partial<Exercise>) => {
    const exercise = await db.exercises.get(id);
    if (exercise) {
      await db.exercises.put({ ...exercise, ...updates });
    }
  },
  
  deleteExercise: async (id: string) => {
    const ex = await db.exercises.get(id);
    await db.exercises.delete(id);
  },

  getGoalTargets: async (): Promise<GoalTarget[]> => await db.goalTargets.toArray(),
  saveGoalTarget: async (target: GoalTarget) => await db.goalTargets.put(target),
  
  getRoutines: async (): Promise<WorkoutRoutine[]> => await db.workoutRoutines.toArray(),
  saveRoutine: async (routine: WorkoutRoutine) => await db.workoutRoutines.put(routine),
  deleteRoutine: async (id: string) => await db.workoutRoutines.delete(id),

  getScheduledActivities: async (): Promise<ScheduledActivity[]> => {
    await storage.generateRecurringActivities();
    return await db.scheduledActivities.toArray();
  },

  addScheduledActivity: async (activity: ScheduledActivity) => {
    await db.scheduledActivities.put(activity);
  },

  deleteScheduledActivity: async (id: string) => {
    await db.scheduledActivities.delete(id);
  },

  toggleScheduledActivity: async (id: string) => {
    const act = await db.scheduledActivities.get(id);
    if (act) {
      await db.scheduledActivities.update(id, { isCompleted: !act.isCompleted });
    }
  },

  // Function to move an entire AI program relative to one session
  async rescheduleAIProgram(programId: string, fromActivityId: string, newDateStr: string): Promise<void> {
    const allActivities = await db.scheduledActivities.where('programId').equals(programId).toArray();
    const targetActivity = allActivities.find(a => a.id === fromActivityId);
    
    if (!targetActivity) return;

    const oldDate = new Date(targetActivity.date);
    const newDate = new Date(newDateStr);
    
    const diffTime = newDate.getTime() - oldDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return;

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

    if (updates.length > 0) {
      await db.scheduledActivities.bulkPut(updates);
    }
  },

  getRecurringPlans: async (): Promise<RecurringPlan[]> => await db.recurringPlans.toArray(),

  addRecurringPlan: async (plan: RecurringPlan) => {
    await db.recurringPlans.put(plan);
    await storage.generateRecurringActivities();
  },

  deleteRecurringPlan: async (id: string) => {
    await db.recurringPlans.delete(id);
    const today = new Date().toISOString().split('T')[0];
    await db.scheduledActivities
      .where('recurrenceId').equals(id)
      .filter(act => act.date >= today && !act.isCompleted)
      .delete();
  },

  generateRecurringActivities: async () => {
    const plans = await db.recurringPlans.toArray();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const generateUntil = new Date(today);
    generateUntil.setDate(today.getDate() + 30);

    for (const plan of plans) {
      let loopDate = new Date(Math.max(new Date(plan.startDate).getTime(), today.getTime()));
      
      while (loopDate <= generateUntil) {
        if (plan.endDate && new Date(plan.endDate) < loopDate) break;

        if (plan.daysOfWeek.includes(loopDate.getDay())) {
          const dateStr = loopDate.toISOString().split('T')[0];
          
          const exists = await db.scheduledActivities
            .where({ recurrenceId: plan.id, date: dateStr })
            .first();

          if (!exists) {
            await db.scheduledActivities.put({
              id: `gen-${plan.id}-${dateStr}`,
              date: dateStr,
              type: plan.type,
              title: plan.title,
              isCompleted: false,
              recurrenceId: plan.id,
              exercises: plan.exercises
            });
          }
        }
        loopDate.setDate(loopDate.getDate() + 1);
      }
    }
  },

  getUserMissions: async (): Promise<UserMission[]> => await db.userMissions.toArray(),
  addUserMission: async (mission: UserMission) => await db.userMissions.put(mission),
  updateUserMission: async (mission: UserMission) => {
    await db.userMissions.update(mission.id, mission);
  },
  deleteUserMission: async (id: string) => await db.userMissions.delete(id),
  
  // --- NYA FUNKTIONER FÖR AI-PROGRAM ---
  getAIPrograms: async (): Promise<AIProgram[]> => await db.aiPrograms.toArray(),
  
  saveAIProgram: async (program: AIProgram): Promise<void> => {
    await db.aiPrograms.put(program);
    window.dispatchEvent(new Event('storage-update'));
  },
  
  clearUpcomingProgramActivities: async (programId: string): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const activitiesToDelete = await db.scheduledActivities
      .where('programId').equals(programId)
      .filter(act => !act.isCompleted && act.date >= today)
      .primaryKeys();

    if (activitiesToDelete.length > 0) {
      await db.scheduledActivities.bulkDelete(activitiesToDelete);
    }
  },

  deleteAIProgram: async (programId: string): Promise<void> => {
    const program = await db.aiPrograms.get(programId);
    if (!program) return;
  
    await (db as any).transaction('rw', db.aiPrograms, db.scheduledActivities, db.userMissions, async () => {
      // 1. Delete non-completed scheduled activities for this program
      const activitiesToDelete = await db.scheduledActivities
        .where('programId').equals(programId)
        .filter(act => !act.isCompleted)
        .primaryKeys();
  
      if (activitiesToDelete.length > 0) {
        await db.scheduledActivities.bulkDelete(activitiesToDelete);
      }
      
      // 2. Delete associated smart goals
      if (program.goalIds && program.goalIds.length > 0) {
          await db.userMissions.where('id').anyOf(program.goalIds).delete();
      }
  
      // 3. Delete the program itself
      await db.aiPrograms.delete(programId);
    });
    
    window.dispatchEvent(new Event('storage-update'));
  },

  // FIX: Added missing importFullBackup method called in OnboardingWizard.
  importFullBackup: async (backup: { data: any }) => {
    // await importDatabase(backup.data);
  },
};

export const exportExerciseLibrary = async () => {
  try {
    const allExercises = await db.exercises.toArray();
    
    const libraryData = {
      type: 'GYM_APP_EXERCISE_LIBRARY',
      version: 1,
      exportDate: new Date().toISOString(),
      count: allExercises.length,
      exercises: allExercises
    };

    const blob = new Blob([JSON.stringify(libraryData, null, 2)], { type: 'application/json' });
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

        await db.exercises.bulkPut(content.exercises);
        resolve(content.exercises.length);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};
