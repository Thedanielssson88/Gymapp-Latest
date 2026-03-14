
// utils/progression.ts
import { UserMission, SmartGoalConfig, WorkoutSession, BiometricLog, PlannedExercise, Exercise, MuscleGroup, WorkoutSet } from '../types';
import { calculate1RM } from './fitness'; // Importera från fitness för att undvika dubbletter

// --- NYA TYPER OCH MATRIS FÖR ADAPTIV PROGRESSION ---
export type Aggressiveness = 'conservative' | 'normal' | 'aggressive';
export type ProgressTrend = 'regression' | 'plateau' | 'moderate' | 'high';

export interface ProgressionRules {
  loadMultiplier: number;
  volumeAction: 'maintain' | 'increase' | 'decrease';
  feedback: string;
}

export const PROGRESSION_MATRIX: Record<Aggressiveness, Record<ProgressTrend, ProgressionRules>> = {
  aggressive: {
    high: { 
      loadMultiplier: 1.05, 
      volumeAction: 'increase', 
      feedback: "Du krossade det förra fasen! Vi ökar både vikt och volym för att maxa dina gains." 
    },
    moderate: { 
      loadMultiplier: 1.025, 
      volumeAction: 'maintain', 
      feedback: "Bra jobbat! Vi fortsätter öka progressivt, men håller volymen stabil." 
    },
    plateau: { 
      loadMultiplier: 1.0, 
      volumeAction: 'decrease', 
      feedback: "Jag ser att du vill köra aggressivt, men din utveckling planade ut lite. Jag har justerat schemat med nya reps-intervall för att bygga upp grundstyrkan igen." 
    },
    regression: { 
      loadMultiplier: 0.95, 
      volumeAction: 'maintain', 
      feedback: "Vi backar bandet lite för att återhämta oss och komma tillbaka starkare (Deload)." 
    }
  },
  normal: {
    high: { 
      loadMultiplier: 1.025, 
      volumeAction: 'maintain', 
      feedback: "Stabilt! Din styrka ökar snabbare än väntat, så jag har lagt på lite extra vikt." 
    },
    moderate: {
      loadMultiplier: 1.01,
      volumeAction: 'maintain',
      feedback: "Vi håller kursen med en balanserad ökning."
    },
    plateau: { 
        loadMultiplier: 1.0, 
        volumeAction: 'maintain', 
        feedback: "Vi håller vikterna stabila denna fas för att befästa tekniken." 
    },
    regression: { 
        loadMultiplier: 0.95, 
        volumeAction: 'decrease', 
        feedback: "Vi sänker tempot lite för att prioritera återhämtning." 
    }
  },
  conservative: {
     high: { 
        loadMultiplier: 1.01, 
        volumeAction: 'maintain', 
        feedback: "Du blir starkare! Vi ökar försiktigt enligt plan." 
     },
     moderate: { 
        loadMultiplier: 1.0, 
        volumeAction: 'maintain', 
        feedback: "Vi fortsätter i din takt." 
     },
     plateau: { 
        loadMultiplier: 1.0, 
        volumeAction: 'maintain', 
        feedback: "Ingen stress. Vi fortsätter jobba på rutinen." 
     },
     regression: { 
        loadMultiplier: 0.95, 
        volumeAction: 'maintain', 
        feedback: "Vi anpassar oss efter dagsformen." 
     }
  }
};

export const analyzeProgressTrend = (startStats: any, currentStats: any): ProgressTrend => {
    if (!startStats || !currentStats) return 'plateau';

    const categories = ['push', 'pull', 'legs'];
    let totalImprovement = 0;
    let categoryCount = 0;

    for (const cat of categories) {
        const start = startStats[cat]?.max1RM || 0;
        const current = currentStats[cat]?.max1RM || 0;

        if (start > 0) {
            const improvement = (current - start) / start;
            totalImprovement += improvement;
            categoryCount++;
        }
    }

    if (categoryCount === 0) return 'plateau';

    const avgImprovement = totalImprovement / categoryCount;

    if (avgImprovement > 0.05) return 'high';
    if (avgImprovement > 0.01) return 'moderate';
    if (avgImprovement > -0.02) return 'plateau';
    return 'regression';
};


// --- PPL-ANALYS OCH VIKTFÖRSLAG ---

const MUSCLE_CATS: Record<string, MuscleGroup[]> = {
  push: ['Bröst', 'Axlar', 'Triceps', 'Framsida lår'],
  pull: ['Rygg', 'Biceps', 'Underarmar', 'Trapezius', 'Baksida lår'],
  legs: ['Framsida lår', 'Baksida lår', 'Säte', 'Vader', 'Adduktorer', 'Abduktorer']
};

export const calculatePPLStats = (history: WorkoutSession[], allExercises: Exercise[]) => {
  const stats = {
    push: { max1RM: 0, score: 0, level: 'Nybörjare' as 'Nybörjare' | 'Motionär' | 'Erfaren' | 'Atlet' | 'Elit' },
    pull: { max1RM: 0, score: 0, level: 'Nybörjare' as 'Nybörjare' | 'Motionär' | 'Erfaren' | 'Atlet' | 'Elit' },
    legs: { max1RM: 0, score: 0, level: 'Nybörjare' as 'Nybörjare' | 'Motionär' | 'Erfaren' | 'Atlet' | 'Elit' }
  };

  history.forEach(session => {
    session.exercises.forEach(sessionEx => {
      const def = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!def) return;

      let category: 'push' | 'pull' | 'legs' | null = null;
      
      if (def.primaryMuscles.some(m => MUSCLE_CATS.legs.includes(m))) category = 'legs';
      else if (def.primaryMuscles.some(m => MUSCLE_CATS.pull.includes(m))) category = 'pull';
      else if (def.primaryMuscles.some(m => MUSCLE_CATS.push.includes(m))) category = 'push';

      if (category) {
        sessionEx.sets.forEach(set => {
          if (set.weight > 0 && set.reps > 0) {
            const e1rm = calculate1RM(set.weight, set.reps);
            if (e1rm > stats[category].max1RM) {
              stats[category].max1RM = Math.round(e1rm);
            }
          }
        });
      }
    });
  });

  stats.push.score = Math.min(100, Math.round((stats.push.max1RM / 140) * 100));
  stats.pull.score = Math.min(100, Math.round((stats.pull.max1RM / 200) * 100));
  stats.legs.score = Math.min(100, Math.round((stats.legs.max1RM / 180) * 100));

  const getLevel = (score: number): 'Nybörjare' | 'Motionär' | 'Erfaren' | 'Atlet' | 'Elit' => {
    if (score < 20) return "Nybörjare";
    if (score < 40) return "Motionär";
    if (score < 60) return "Erfaren";
    if (score < 80) return "Atlet";
    return "Elit";
  };

  stats.push.level = getLevel(stats.push.score);
  stats.pull.level = getLevel(stats.pull.score);
  stats.legs.level = getLevel(stats.legs.score);

  return stats;
};

export const suggestWeightForReps = (
  exerciseId: string, 
  targetReps: number, 
  history: WorkoutSession[]
): number => {
  let max1RM = 0;
  
  history.forEach(session => {
    session.exercises.forEach(ex => {
      if (ex.exerciseId === exerciseId) {
        ex.sets.forEach(set => {
          if (set.weight > 0 && set.reps > 0) {
            const e1rm = calculate1RM(set.weight, set.reps);
            if (e1rm > max1RM) max1RM = e1rm;
          }
        });
      }
    });
  });

  if (max1RM === 0) return 0; 

  const suggestedWeight = max1RM / (1 + targetReps / 30);
  
  return Math.round(suggestedWeight / 2.5) * 2.5;
};


// --- BEFINTLIG KOD ---

interface ProgressionResult {
  expectedValue: number;
  expectedReps: number;
  statusDiff: number;
  progressRatio: number;
  unit: string;
}

export const getHistoryForGoal = (config: SmartGoalConfig, historyLogs: WorkoutSession[], bioLogs: BiometricLog[]) => {
  if (config.targetType === 'exercise' && config.exerciseId) {
    return historyLogs
      .filter(h => h.exercises && h.exercises.some((e: PlannedExercise) => e.exerciseId === config.exerciseId))
      .map(h => {
        const ex = h.exercises.find((e: PlannedExercise) => e.exerciseId === config.exerciseId);
        const maxWeight = ex && ex.sets ? Math.max(...ex.sets.map((s: any) => s.weight || 0)) : 0;
        return { date: h.date, value: maxWeight };
      })
      .filter(d => d.value > 0);
  } else {
    return bioLogs.map(log => ({
      date: log.date,
      value: config.targetType === 'body_weight' 
        ? log.weight 
        : (log.measurements?.[config.measurementKey as keyof typeof log.measurements] || 0)
    })).filter(d => d.value > 0);
  }
};

export const calculateSmartProgression = (
  mission: UserMission, 
  currentValue: number
): ProgressionResult | null => {
  if (mission.type !== 'smart_goal' || !mission.smartConfig) return null;

  const { startValue, targetValue, startReps = 8, targetReps = 5, deadline, strategy, targetType, measurementKey } = mission.smartConfig;
  
  const now = new Date().getTime();
  const start = new Date(mission.createdAt).getTime();
  const end = new Date(deadline).getTime();
  const totalTime = end - start;
  
  const progressRatio = totalTime > 0 ? Math.min(Math.max((now - start) / totalTime, 0), 1) : 0;

  let expectedValue = startValue;
  let expectedReps = startReps;
  const totalChange = targetValue - startValue;

  switch (strategy) {
    case 'linear':
      expectedValue = startValue + (totalChange * progressRatio);
      expectedReps = startReps + ((targetReps - startReps) * progressRatio);
      break;
    case 'undulating':
      expectedValue = startValue + (totalChange * progressRatio);
      expectedReps = startReps + ((targetReps - startReps) * progressRatio);
      break;
    case 'peaking':
      const curve = progressRatio * progressRatio;
      expectedValue = startValue + (totalChange * curve);
      expectedReps = startReps + ((targetReps - startReps) * progressRatio);
      break;
  }

  if (targetType === 'exercise') {
    expectedValue = Math.round(expectedValue / 2.5) * 2.5;
    expectedReps = Math.round(expectedReps);
  } else {
    expectedValue = parseFloat(expectedValue.toFixed(1));
  }

  const statusDiff = expectedValue - currentValue;
  
  let unit = 'kg';
  if(targetType === 'body_measurement') {
    if(measurementKey === 'bodyFat') unit = '%';
    else unit = 'cm';
  }

  return { expectedValue, expectedReps, statusDiff, progressRatio, unit };
};

export const checkProgressiveOverload = (
  prevSets: WorkoutSet[], 
  currentSets: WorkoutSet[], 
  exercise: Exercise
): { improved: boolean; factor: number } => {
  
  const validPrev = prevSets.filter(s => s.completed);
  const validCurr = currentSets.filter(s => s.completed);

  if (validPrev.length === 0 || validCurr.length === 0) return { improved: false, factor: 0 };

  // Hämta "bästa" prestationen baserat på typ
  const getBestMetric = (sets: WorkoutSet[]) => {
    switch (exercise.trackingType) {
      case 'time_only':
        // Jämför längsta tid (duration)
        return Math.max(...sets.map(s => s.duration || 0));
      case 'time_distance':
        // Jämför längsta distans (eller tid om man vill, men distans är oftast prio)
        return Math.max(...sets.map(s => s.distance || 0));
      case 'reps_only':
        // Jämför max antal reps
        return Math.max(...sets.map(s => s.reps || 0));
      default:
        // Styrka: Jämför 1RM
        return Math.max(...sets.map(s => (s.weight || 0) * (1 + (s.reps || 0) / 30)));
    }
  };

  const prevBest = getBestMetric(validPrev);
  const currBest = getBestMetric(validCurr);

  if (currBest > prevBest) {
    const increase = (currBest - prevBest) / (prevBest || 1); // Undvik dela med noll
    return { improved: true, factor: increase };
  }

  return { improved: false, factor: 0 };
};
