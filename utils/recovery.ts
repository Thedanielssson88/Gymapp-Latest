
import { WorkoutSession, MuscleGroup, Exercise, WorkoutSet, UserProfile } from '../types';

export type MuscleStatus = {
  [key in MuscleGroup]: number; // 0 to 100
};

const RECOVERY_HOURS = 72; // Ökat till 72h för att matcha tung styrketräning

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'Mage', 'Rygg', 'Biceps', 'Bröst', 'Säte', 'Baksida lår', 
  'Framsida lår', 'Axlar', 'Triceps', 'Ryggslut', 'Vader', 
  'Trapezius', 'Abduktorer', 'Adduktorer', 'Underarmar', 'Nacke'
];

/**
 * Räknar ut belastningspåverkan (Fatigue) för en specifik övning.
 * Används både för live-visualisering och långsiktig återhämtningslogik.
 */
export const calculateExerciseImpact = (
  exData: Exercise, 
  sets: WorkoutSet[], 
  userBodyWeight: number
): number => {
  const validSets = sets.filter(s => (s.reps || 0) > 0 || (s.duration || 0) > 0 || (s.distance || 0) > 0);
  if (validSets.length === 0) return 0;

  const totalImpact = validSets.reduce((sum, s) => {
    const trackingType = exData.trackingType || 'reps_weight';
    let setImpact = 0;
    
    switch(trackingType) {
        case 'time_only':
            // Tid: 1 poäng per sekund * bwFactor.
            const duration = s.duration || 0;
            const bwFactorTime = (userBodyWeight / 60) * (exData.bodyweightCoefficient || 0.5);
            setImpact = duration * 1.5 * Math.max(1, bwFactorTime) * (exData.difficultyMultiplier || 1);
            break;
            
        case 'time_distance':
            // Cardio - Uppskruvat rejält för att matcha tunga lyft
            // 10km = 10000m * 1.5 = 15000p.
            // 60min = 3600s * 0.2 = 720p.
            // Total ~15720p för 10km/h. Med divisor 300 ger detta ~52 i Strain Score (Mycket ansträngande).
            const distancePoints = (s.distance || 0) * 1.5; 
            const timePoints = (s.duration || 0) * 0.2;
            setImpact = (distancePoints + timePoints) * (exData.difficultyMultiplier || 1);
            break;
            
        case 'reps_only':
            // Kroppsvikt
            const bodyweightLoadReps = userBodyWeight * (exData.bodyweightCoefficient || 0.7);
            setImpact = bodyweightLoadReps * (s.reps || 0) * (exData.difficultyMultiplier || 1);
            break;

        case 'distance_weight':
            // Farmers walk
            const carryImpact = (s.weight || 0) * (s.distance || 0) * 1.0;
            setImpact = carryImpact * (exData.difficultyMultiplier || 1);
            break;
            
        case 'reps_weight':
        default:
            const addedBodyweightLoad = userBodyWeight * (exData.bodyweightCoefficient || 0);
            const effectiveLoad = addedBodyweightLoad + (s.weight || 0);
            
            // Icke-linjär skalning för tunga lyft.
            // Tidigare: 1 + (load / 200). Nu: 1 + (load / 100).
            // Exempel 140kg: 1 + 1.4 = 2.4 multiplier (istället för 1.7).
            // Detta gör att tunga basövningar smäller mycket högre.
            const heavyLoadFactor = 1 + (effectiveLoad / 100);
            
            setImpact = effectiveLoad * (s.reps || 0) * heavyLoadFactor * (exData.difficultyMultiplier || 1);
            break;
    }
    return sum + setImpact;
  }, 0);
  
  return totalImpact;
};


export const calculateMuscleRecovery = (
  history: WorkoutSession[], 
  allExercises: Exercise[], 
  userProfile: UserProfile | null
): MuscleStatus => {
  const status: MuscleStatus = {} as MuscleStatus;
  ALL_MUSCLE_GROUPS.forEach(m => status[m] = 100);

  if (!userProfile) return status;

  const now = new Date().getTime();
  const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedHistory.forEach(session => {
    const sessionTime = new Date(session.date).getTime();
    const hoursSince = (now - sessionTime) / (1000 * 60 * 60);
    
    // Använder den nya konstanten (72h)
    if (hoursSince > (RECOVERY_HOURS * 1.5)) return;

    const sessionRpe = session.rpe || 7.5; 
    const intensityFactor = sessionRpe / 7.5; 

    session.exercises.forEach(plannedEx => {
      const exData = allExercises.find(e => e.id === plannedEx.exerciseId);
      if (!exData) return;

      const setsToCount = (plannedEx.sets.filter(s => s.completed).length > 0)
        ? plannedEx.sets.filter(s => s.completed)
        : (session.isCompleted ? plannedEx.sets : []);

      if (setsToCount.length === 0) return;

      const baseFatigue = calculateExerciseImpact(exData, setsToCount, userProfile.weight);
      
      // SÄNKT DIVISOR: Från 300 till 60.
      // Detta gör systemet 5 gånger känsligare.
      // Exempel 140kg bänk x 8 x 4 = ~10,000 impact / 60 = 166% fatigue -> 0% återhämtning. Rätt.
      // Exempel 40kg RDL x 10 x 3 = ~1600 impact / 60 = 26% fatigue. Rätt.
      const finalFatigue = (baseFatigue / 60) * intensityFactor;

      const primaries = exData.primaryMuscles?.length ? exData.primaryMuscles : exData.muscleGroups;
      primaries?.forEach(m => applyFatigue(status, m, finalFatigue, hoursSince));
      exData.secondaryMuscles?.forEach(m => applyFatigue(status, m, finalFatigue * 0.5, hoursSince));
    });
  });

  return status;
};

const applyFatigue = (status: MuscleStatus, muscle: MuscleGroup, amount: number, hoursSince: number) => {
  if (status[muscle] === undefined) return;
  
  // Återhämtningen är nu spridd över 72h
  const recoveryFactor = Math.min(1, hoursSince / RECOVERY_HOURS);
  
  // Icke-linjär återhämtning (går långsammare i början om man är riktigt sliten)
  // Men vi håller det linjärt för nu för att det är mer förutsägbart för användaren.
  const remainingFatigue = amount * (1 - recoveryFactor);

  if (remainingFatigue > 0) {
    status[muscle] = Math.max(0, status[muscle] - remainingFatigue);
  }
};

export const getRecoveryColor = (score: number, isSelected?: boolean) => {
  if (isSelected) return '#ff2d55'; 
  if (score >= 90) return 'rgba(255, 255, 255, 0.2)'; 
  if (score >= 70) return '#ffd6dd'; 
  if (score >= 50) return '#ff8095'; 
  if (score >= 30) return '#ff2d55'; 
  return '#990022'; 
};

export const getRecoveryStatus = (score: number): string => {
  if (score >= 90) return 'Fräsch';
  if (score >= 70) return 'OK';
  if (score >= 50) return 'Trött';
  if (score >= 30) return 'Sliten';
  return 'Utmattad';
};

export interface WorkloadDetail {
  date: string;
  exerciseName: string;
  sets: WorkoutSet[];
  role: 'Primär' | 'Sekundär';
  impactScore: number;
  trackingType?: 'reps_weight' | 'time_distance' | 'time_only' | 'reps_only' | 'reps_time_weight' | 'distance_weight';
}

export const getMuscleWorkloadDetails = (
  muscle: MuscleGroup, 
  history: WorkoutSession[],
  allExercises: Exercise[]
): WorkloadDetail[] => {
  const details: WorkloadDetail[] = [];
  const now = new Date();
  const RECOVERY_WINDOW_HOURS = 96; // 4 dagar för historik-listan

  const recentHistory = history.filter(h => {
      const diff = now.getTime() - new Date(h.date).getTime();
      return diff < (1000 * 60 * 60 * RECOVERY_WINDOW_HOURS); 
  });

  recentHistory.forEach(session => {
    session.exercises.forEach(sessionEx => {
      const exDef = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!exDef) return;

      const hitsPrimary = exDef.primaryMuscles?.includes(muscle);
      const hitsSecondary = exDef.secondaryMuscles?.includes(muscle);

      if (hitsPrimary || hitsSecondary) {
        const completedSets = sessionEx.sets.filter(s => s.completed);
        if (completedSets.length === 0) return;
        
        const hoursSince = (now.getTime() - new Date(session.date).getTime()) / 3600000;
        
        // Use a simpler calc for the list view, but decaying
        const rawScore = completedSets.length * (exDef.difficultyMultiplier || 1) * (hitsPrimary ? 10 : 5);
        const decayedScore = Math.max(0, rawScore * (1 - hoursSince / RECOVERY_WINDOW_HOURS));

        if (decayedScore > 0.5) {
          details.push({
            date: session.date,
            exerciseName: exDef.name,
            sets: completedSets,
            role: hitsPrimary ? 'Primär' : 'Sekundär',
            impactScore: decayedScore,
            trackingType: sessionEx.trackingTypeOverride || exDef.trackingType
          });
        }
      }
    });
  });
  
  const groupedDetails = details.reduce((acc, curr) => {
    const key = `${curr.date}-${curr.exerciseName}`;
    if (!acc[key]) {
      acc[key] = { ...curr, impactScore: 0, sets: [] };
    }
    acc[key].impactScore += curr.impactScore;
    acc[key].sets.push(...curr.sets);
    return acc;
  }, {} as Record<string, WorkloadDetail>);

  return Object.values(groupedDetails).sort((a, b) => b.impactScore - a.impactScore);
};
