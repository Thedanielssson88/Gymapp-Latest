
import { Exercise, WorkoutSession, WorkoutSet, PlannedExercise, Zone, MuscleGroup, Equipment, Goal, UserProfile, ExerciseTier, MovementPattern } from '../types';
import { calculateMuscleRecovery } from './recovery';

/**
 * Hjälpfunktion för att kolla kraven för en övning i en specifik zon.
 * Stödjer AND/OR-logik.
 */
export const hasRequiredEquipment = (ex: Exercise, zoneInventory: Equipment[]): boolean => {
  // Om inga krav finns definierade, utgå från att ALL utrustning i listan krävs (fallback)
  if (!ex.equipmentRequirements || ex.equipmentRequirements.length === 0) {
    return ex.equipment.every(eq => zoneInventory.includes(eq));
  }

  // NY LOGIK: "OCH" mellan grupper, "ELLER" inom grupper
  return ex.equipmentRequirements.every(group => 
    group.some(item => zoneInventory.includes(item))
  );
};

/**
 * Beräknar 1RM baserat på Brzycki-formeln.
 */
export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps === 0) return 0;
  const raw1RM = weight * (1 + reps / 30);
  return Math.round(raw1RM * 2) / 2;
};

/**
 * Hittar en ersättningsövning i samma mönster som finns i målzonen.
 */
export const findReplacement = (currentExercise: Exercise, targetZone: Zone, allExercises: Exercise[]): Exercise => {
  const candidates = allExercises.filter(ex => 
    ex.pattern === currentExercise.pattern &&
    hasRequiredEquipment(ex, targetZone.inventory)
  );
  if (candidates.length === 0) return currentExercise;
  return candidates.sort((a, b) => 
    Math.abs(b.difficultyMultiplier - currentExercise.difficultyMultiplier) - 
    Math.abs(a.difficultyMultiplier - currentExercise.difficultyMultiplier)
  )[0];
};

/**
 * Justerar volym (reps/vikt) vid byte av övning baserat på svårighetsgrad.
 */
export const adaptVolume = (originalSets: WorkoutSet[], originalEx: Exercise, newEx: Exercise, userGoal: Goal): WorkoutSet[] => {
  const diffRatio = originalEx.difficultyMultiplier / newEx.difficultyMultiplier;
  return originalSets.map(set => ({
    ...set,
    reps: Math.min(30, Math.ceil(set.reps * diffRatio)),
    weight: Math.round((set.weight / diffRatio) * 2) / 2,
    completed: false
  }));
};

/**
 * Hämtar senaste set-prestationen för en specifik övning.
 */
export const getLastPerformance = (exerciseId: string, history: WorkoutSession[]): WorkoutSet[] | null => {
  const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const session of sortedHistory) {
    const ex = session.exercises.find(e => e.exerciseId === exerciseId);
    if (ex && ex.sets.some(s => s.completed)) return ex.sets.filter(s => s.completed); 
  }
  return null;
};

/**
 * Skapar set med progressiv överbelastning.
 */
export const createSmartSets = (lastSets: WorkoutSet[], applyOverload: boolean, exercise: Exercise): WorkoutSet[] => {
  return lastSets.map(s => {
    let newWeight = s.weight;
    let newReps = s.reps;
    let newDuration = s.duration;
    let newDistance = s.distance;

    if (applyOverload && s.completed && s.type !== 'warmup') {
      const rpe = s.rpe || 8;
      const trackingType = exercise.trackingType || 'reps_weight';
      
      // Low RPE means we can increase the load
      if (rpe < 7) { 
        switch (trackingType) {
          case 'time_only':
            newDuration = (s.duration || 0) + 5; // Add 5 seconds
            break;
          case 'time_distance':
            newDistance = (s.distance || 0) + Math.max(50, (s.distance || 0) * 0.05); // Add 50m or 5%
            newDuration = s.duration;
            break;
          case 'reps_only':
            newReps = (s.reps || 0) + 1; // Add 1 rep
            break;
          case 'reps_weight':
          default:
            newWeight = (s.weight || 0) + 2.5; // Add 2.5kg
            break;
        }
      } else if (rpe >= 9) {
        // High RPE, maintain load
      } else { // RPE 7-8, standard small progression
        switch (trackingType) {
          case 'time_only':
            newDuration = (s.duration || 0) + 2; // Add 2 seconds
            break;
          case 'time_distance':
            newDistance = (s.distance || 0) + Math.max(25, (s.distance || 0) * 0.025); // Add 25m or 2.5%
            newDuration = s.duration;
            break;
          case 'reps_only':
            newReps = s.reps; // no change, focus on form
            break; 
          case 'reps_weight':
          default:
            newWeight = (s.weight || 0) + 1.25; // Add 1.25kg
            break;
        }
      }
    }

    return { 
      reps: newReps, 
      weight: newWeight,
      duration: newDuration,
      distance: newDistance,
      type: s.type || 'normal', 
      completed: false 
    };
  });
};

/**
 * Hjälpfunktion för att bestämma set och reps baserat på mål och övnings-tier.
 */
const getTargetVolume = (goal: Goal, tier: ExerciseTier = 'tier_2') => {
  if (goal === Goal.STRENGTH) {
    if (tier === 'tier_1') return { sets: 5, reps: 5 }; 
    if (tier === 'tier_2') return { sets: 4, reps: 8 }; 
    return { sets: 3, reps: 12 }; 
  }
  
  if (goal === Goal.ENDURANCE) {
    return { sets: 3, reps: 15 };
  }

  if (goal === Goal.REHAB) {
     return { sets: 3, reps: 15 };
  }

  // HYPERTROFI (Default)
  if (tier === 'tier_1') return { sets: 4, reps: 8 };
  if (tier === 'tier_2') return { sets: 3, reps: 10 };
  return { sets: 3, reps: 12 }; 
};

/**
 * Föreslår vikt baserat på historik och målantal reps.
 */
const suggestWeight = (exerciseId: string, history: WorkoutSession[], targetReps: number): number => {
  const lastSets = getLastPerformance(exerciseId, history);
  if (!lastSets || lastSets.length === 0) return 0;

  const bestSet = lastSets.reduce((prev, current) => 
    ((current.weight || 0) * (current.reps || 0) > (prev.weight || 0) * (prev.reps || 0)) ? current : prev
  );

  if (bestSet.reps >= targetReps) {
    return (bestSet.weight || 0) + 2.5; 
  }
  
  return bestSet.weight || 0;
};

/**
 * SMART PT GENERATOR
 * Bygger ett pass baserat på muskler, zon, profil, historik och önskat antal övningar.
 */
export const generateWorkoutSession = (
  targetMuscles: MuscleGroup[], 
  zone: Zone, 
  allExercises: Exercise[],
  userProfile: UserProfile,
  history: WorkoutSession[],
  exerciseCount: number = 6
): PlannedExercise[] => {
  
  const plannedExercises: PlannedExercise[] = [];
  const recoveryStatus = calculateMuscleRecovery(history, allExercises, userProfile);
  const injuries = userProfile.injuries || [];

  // 1. Filtrera fram möjliga övningar
  let candidates = allExercises.filter(ex => {
    const hasEquipment = hasRequiredEquipment(ex, zone.inventory);
    if (!hasEquipment) return false;

    // Träffar valda muskelgrupper
    const hitsTarget = ex.muscleGroups.some(m => targetMuscles.includes(m));
    if (!hitsTarget) return false;

    // Skadeskydd
    const impactsInjuredMuscle = ex.primaryMuscles.some(m => injuries.includes(m));
    if (impactsInjuredMuscle) {
      return ex.pattern === MovementPattern.REHAB;
    }

    return true;
  });

  // 2. Definiera strukturen för passet (Tiers)
  const structure: ExerciseTier[] = [];
  if (exerciseCount >= 1) structure.push('tier_1');
  const midCount = Math.max(0, Math.floor((exerciseCount - 1) * 0.6));
  for (let i = 0; i < midCount; i++) structure.push('tier_2');
  while (structure.length < exerciseCount) {
    structure.push('tier_3');
  }

  // 3. Välj övningar baserat på struktur och återhämtning
  const selectedIds = new Set<string>();

  structure.forEach(targetTier => {
    let pool = candidates.filter(ex => !selectedIds.has(ex.id) && ex.tier === targetTier);
    
    if (pool.length === 0) {
        pool = candidates.filter(ex => !selectedIds.has(ex.id));
    }

    if (pool.length > 0) {
      // Sortera poolen baserat på återhämtning och övningspoäng
      pool.sort((a, b) => {
        const scoreA = a.score || 5;
        const scoreB = b.score || 5;
        const recoveryScoreA = (recoveryStatus[a.primaryMuscles[0]] || 100);
        const recoveryScoreB = (recoveryStatus[b.primaryMuscles[0]] || 100);
        
        const finalScoreA = recoveryScoreA * (scoreA / 10);
        const finalScoreB = recoveryScoreB * (scoreB / 10);
        
        return finalScoreB - finalScoreA;
      });

      const chosen = pool[0];
      const volume = getTargetVolume(userProfile.goal, chosen.tier);
      const weight = suggestWeight(chosen.id, history, volume.reps);

      plannedExercises.push({
        exerciseId: chosen.id,
        sets: Array(volume.sets).fill(null).map(() => ({
          reps: volume.reps,
          weight: weight,
          completed: false,
          type: 'normal'
        })),
        notes: chosen.pattern === MovementPattern.REHAB ? 'Rehab-fokus pga skada.' : 'Smart PT val'
      });
      
      selectedIds.add(chosen.id);
    }
  });

  return plannedExercises;
};
