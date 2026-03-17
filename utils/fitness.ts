
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
 * Hjälpfunktion för att bestämma set och reps baserat på mål, övnings-tier och biologiskt kön.
 * Kvinnor får fler set men samma reps (högre volymtolerans).
 */
const getTargetVolume = (goal: Goal, tier: ExerciseTier = 'tier_2', biologicalSex?: 'Man' | 'Kvinna' | 'Annan') => {
  // Volymjustering baserat på kön
  // Kvinnor: +1 set (högre volymtolerans)
  // Annan: +0.5 set (avrundat till närmaste heltal)
  const volumeBonus = biologicalSex === 'Kvinna' ? 1 : (biologicalSex === 'Annan' ? 1 : 0);

  if (goal === Goal.STRENGTH) {
    if (tier === 'tier_1') return { sets: 5 + volumeBonus, reps: 5 };
    if (tier === 'tier_2') return { sets: 4 + volumeBonus, reps: 8 };
    return { sets: 3 + volumeBonus, reps: 12 };
  }

  if (goal === Goal.ENDURANCE) {
    return { sets: 3 + volumeBonus, reps: 15 };
  }

  if (goal === Goal.REHAB) {
     return { sets: 3 + volumeBonus, reps: 15 };
  }

  // HYPERTROFI (Default)
  if (tier === 'tier_1') return { sets: 4 + volumeBonus, reps: 8 };
  if (tier === 'tier_2') return { sets: 3 + volumeBonus, reps: 10 };
  return { sets: 3 + volumeBonus, reps: 12 };
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

  // FIX #3: Kolla vilka övningar användes senast för variation
  const recentExerciseIds = history
    .slice(0, 3) // Senaste 3 passen
    .flatMap(s => s.exercises.map(ex => ex.exerciseId));

  // 1. Filtrera fram möjliga övningar
  let candidates = allExercises.filter(ex => {
    const hasEquipment = hasRequiredEquipment(ex, zone.inventory);
    if (!hasEquipment) return false;

    // Träffar valda muskelgrupper (kolla både muscleGroups och primaryMuscles)
    const muscleGroups = ex.muscleGroups || [];
    const primaryMuscles = ex.primaryMuscles || [];
    const allMuscles = [...muscleGroups, ...primaryMuscles];
    const hitsTarget = allMuscles.some(m => targetMuscles.includes(m));
    if (!hitsTarget) return false;

    // FIX #1: Förbättrad skadelogik
    const impactsInjuredMuscle = primaryMuscles.some(m => injuries.includes(m));
    if (impactsInjuredMuscle) {
      // Kolla om användaren VALDE att träna den skadade muskeln
      const userSelectedInjuredMuscle = targetMuscles.some(m => injuries.includes(m));
      if (userSelectedInjuredMuscle) {
        // Om användaren explicit valde skadad muskel → bara REHAB tillåts
        return ex.pattern === MovementPattern.REHAB;
      } else {
        // Om användaren INTE valde skadad muskel → skippa övningar som träffar skada
        return false;
      }
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
      // FIX #2 & #3: Sortera baserat på recovery, score OCH variation
      const isSingleMuscleSelection = targetMuscles.length === 1;

      pool.sort((a, b) => {
        const scoreA = a.score || 5;
        const scoreB = b.score || 5;

        // FIX #2: KORREKT recovery-logik
        const isExplicitlySelectedA = a.primaryMuscles.some(m => targetMuscles.includes(m));
        const isExplicitlySelectedB = b.primaryMuscles.some(m => targetMuscles.includes(m));

        let recoveryScoreA: number;
        let recoveryScoreB: number;

        if (isSingleMuscleSelection && isExplicitlySelectedA) {
          // EN muskel vald OCH träffar den → ignorera recovery (träna IDAG)
          recoveryScoreA = 100;
        } else if (isExplicitlySelectedA) {
          // FLERA muskler valda OCH träffar någon → använd recovery (smart fördelning)
          recoveryScoreA = recoveryStatus[a.primaryMuscles[0]] || 100;
        } else {
          // Träffar INTE vald muskel → använd recovery
          recoveryScoreA = recoveryStatus[a.primaryMuscles[0]] || 100;
        }

        if (isSingleMuscleSelection && isExplicitlySelectedB) {
          recoveryScoreB = 100;
        } else if (isExplicitlySelectedB) {
          recoveryScoreB = recoveryStatus[b.primaryMuscles[0]] || 100;
        } else {
          recoveryScoreB = recoveryStatus[b.primaryMuscles[0]] || 100;
        }

        // FIX #3: Straff för övningar som användes nyligen
        const recentCountA = recentExerciseIds.filter(id => id === a.id).length;
        const recentCountB = recentExerciseIds.filter(id => id === b.id).length;
        const recencyPenaltyA = recentCountA * 20; // -20 poäng per gång
        const recencyPenaltyB = recentCountB * 20;

        const finalScoreA = (recoveryScoreA * (scoreA / 10)) - recencyPenaltyA;
        const finalScoreB = (recoveryScoreB * (scoreB / 10)) - recencyPenaltyB;

        return finalScoreB - finalScoreA;
      });

      const chosen = pool[0];
      const volume = getTargetVolume(userProfile.goal, chosen.tier, userProfile.biologicalSex);

      // FIX #4: Progressive overload - kolla senaste prestationen
      const lastPerformance = history
        .flatMap(s => s.exercises)
        .filter(ex => ex.exerciseId === chosen.id)
        .sort((a, b) => {
          const dateA = history.find(s => s.exercises.includes(a))?.date || '';
          const dateB = history.find(s => s.exercises.includes(b))?.date || '';
          return dateB.localeCompare(dateA);
        })[0];

      let weight = suggestWeight(chosen.id, history, volume.reps);

      if (lastPerformance && lastPerformance.sets.length > 0) {
        const lastWeight = lastPerformance.sets[0]?.weight || 0;
        const completedAllSets = lastPerformance.sets.every(s => s.completed);
        const averageReps = lastPerformance.sets.reduce((sum, s) => sum + (s.reps || 0), 0) / lastPerformance.sets.length;

        // FIX #4: Procentbaserad progressive overload baserat på kön, tier och vikt
        const baseRates: Record<string, number> = {
          'Man': 0.025,      // 2.5% för män
          'Kvinna': 0.02,    // 2.0% för kvinnor
          'Annan': 0.02      // 2.0% för andra
        };

        const tierModifiers: Record<ExerciseTier, number> = {
          'tier_1': 1.0,     // Tunga sammansatta övningar
          'tier_2': 0.8,     // Medium övningar
          'tier_3': 0.6      // Isoleringsövningar
        };

        const baseRate = baseRates[userProfile.biologicalSex || 'Annan'] || 0.02;
        const tierMod = tierModifiers[chosen.tier] || 0.8;
        const finalRate = baseRate * tierMod;

        if (completedAllSets && averageReps >= volume.reps) {
          // Om du klarade alla reps senast → öka vikten procentuellt
          let newWeight = lastWeight * (1 + finalRate);

          // Smart avrundning baserat på viktintervall
          if (newWeight < 10) {
            newWeight = Math.ceil(newWeight / 0.5) * 0.5;  // Avrunda till närmaste 0.5kg
          } else if (newWeight < 50) {
            newWeight = Math.ceil(newWeight / 1) * 1;      // Avrunda till närmaste 1kg
          } else {
            newWeight = Math.ceil(newWeight / 2.5) * 2.5;  // Avrunda till närmaste 2.5kg
          }

          weight = Math.max(weight, newWeight);
        } else if (completedAllSets && averageReps >= volume.reps * 0.8) {
          // Om du klarade minst 80% av reps → behåll vikten
          weight = Math.max(weight, lastWeight);
        } else {
          // Om du missade många reps → minska vikten procentuellt
          let newWeight = lastWeight * (1 - finalRate * 0.5);  // Halv minskning jämfört med ökning

          // Smart avrundning vid minskning
          if (newWeight < 10) {
            newWeight = Math.floor(newWeight / 0.5) * 0.5;
          } else if (newWeight < 50) {
            newWeight = Math.floor(newWeight / 1) * 1;
          } else {
            newWeight = Math.floor(newWeight / 2.5) * 2.5;
          }

          weight = Math.max(weight, newWeight);
        }
      }

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
