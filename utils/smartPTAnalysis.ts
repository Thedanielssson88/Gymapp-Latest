// utils/smartPTAnalysis.ts
// Intelligenta analysverktyg för Smart PT Scout med minimal token-usage

import { WorkoutSession, Exercise, MuscleGroup } from '../types';
import { calculate1RM } from './fitness';

// ============================================================================
// MUSKELSYNERGI - Räkna primär (1.0) + sekundär (0.5) belastning
// ============================================================================

export interface MuscleLoadData {
  muscle: MuscleGroup;
  totalSets: number;
  totalVolume: number; // kg × reps
  primary: number; // antal set som primär
  secondary: number; // antal set som sekundär
  weightedSets: number; // primary * 1.0 + secondary * 0.5
}

export const calculateMuscleLoadSynergy = (
  history: WorkoutSession[],
  allExercises: Exercise[],
  daysBack: number = 7
): Map<MuscleGroup, MuscleLoadData> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const muscleLoad = new Map<MuscleGroup, MuscleLoadData>();

  const recentHistory = history.filter(h => new Date(h.date) >= cutoffDate);

  recentHistory.forEach(session => {
    session.exercises.forEach(sessionEx => {
      const exercise = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!exercise) return;

      const completedSets = sessionEx.sets.filter(s => s.completed);
      const totalSets = completedSets.length;

      // Primära muskler (weight = 1.0)
      exercise.primaryMuscles?.forEach(muscle => {
        if (!muscleLoad.has(muscle)) {
          muscleLoad.set(muscle, {
            muscle,
            totalSets: 0,
            totalVolume: 0,
            primary: 0,
            secondary: 0,
            weightedSets: 0
          });
        }
        const data = muscleLoad.get(muscle)!;
        data.totalSets += totalSets;
        data.primary += totalSets;
        data.weightedSets += totalSets * 1.0;

        // Volym = vikt × reps
        completedSets.forEach(set => {
          data.totalVolume += (set.weight || 0) * (set.reps || 0);
        });
      });

      // Sekundära muskler (weight = 0.5)
      exercise.secondaryMuscles?.forEach(muscle => {
        if (!muscleLoad.has(muscle)) {
          muscleLoad.set(muscle, {
            muscle,
            totalSets: 0,
            totalVolume: 0,
            primary: 0,
            secondary: 0,
            weightedSets: 0
          });
        }
        const data = muscleLoad.get(muscle)!;
        data.totalSets += totalSets;
        data.secondary += totalSets;
        data.weightedSets += totalSets * 0.5;

        // Volym för sekundära muskler
        completedSets.forEach(set => {
          data.totalVolume += (set.weight || 0) * (set.reps || 0) * 0.5;
        });
      });
    });
  });

  return muscleLoad;
};

// ============================================================================
// WEAKNESS-DETEKTION - Relativ styrka (1RM/kroppsvikt)
// ============================================================================

export interface MuscleStrengthData {
  muscle: MuscleGroup;
  max1RM: number;
  relative1RM: number; // 1RM / bodyweight
  rank: 'weak' | 'average' | 'strong';
}

export const detectWeakMuscles = (
  history: WorkoutSession[],
  allExercises: Exercise[],
  bodyweight: number
): MuscleStrengthData[] => {
  const muscleStrength = new Map<MuscleGroup, number>();

  // Hitta max 1RM per muskel
  history.forEach(session => {
    session.exercises.forEach(sessionEx => {
      const exercise = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!exercise) return;

      sessionEx.sets.forEach(set => {
        if (set.weight > 0 && set.reps > 0) {
          const e1rm = calculate1RM(set.weight, set.reps);

          exercise.primaryMuscles?.forEach(muscle => {
            const current = muscleStrength.get(muscle) || 0;
            if (e1rm > current) {
              muscleStrength.set(muscle, e1rm);
            }
          });
        }
      });
    });
  });

  // Beräkna relativ styrka
  const strengthData: MuscleStrengthData[] = [];
  muscleStrength.forEach((max1RM, muscle) => {
    const relative1RM = bodyweight > 0 ? max1RM / bodyweight : 0;
    strengthData.push({
      muscle,
      max1RM,
      relative1RM,
      rank: 'average' // Kommer uppdateras nedan
    });
  });

  // Sortera och rangordna
  strengthData.sort((a, b) => b.relative1RM - a.relative1RM);

  const third = Math.ceil(strengthData.length / 3);
  strengthData.forEach((data, idx) => {
    if (idx < third) data.rank = 'strong';
    else if (idx >= strengthData.length - third) data.rank = 'weak';
    else data.rank = 'average';
  });

  return strengthData;
};

// ============================================================================
// DELOAD-DETEKTION - Försämring 2-3 pass i rad
// ============================================================================

export interface DeloadSignal {
  needsDeload: boolean;
  muscle: MuscleGroup | null;
  reason: string;
  consecutiveDeclines: number;
}

export const detectDeloadNeed = (
  history: WorkoutSession[],
  allExercises: Exercise[]
): DeloadSignal => {
  // Analysera senaste 5 passen per muskelgrupp
  const muscleHistory = new Map<MuscleGroup, number[]>();

  // Hämta senaste 10 pass (för att få tillräckligt med data)
  const recentSessions = history.slice(0, 10);

  recentSessions.forEach(session => {
    session.exercises.forEach(sessionEx => {
      const exercise = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!exercise) return;

      sessionEx.sets.forEach(set => {
        if (set.weight > 0 && set.reps > 0) {
          const e1rm = calculate1RM(set.weight, set.reps);

          exercise.primaryMuscles?.forEach(muscle => {
            if (!muscleHistory.has(muscle)) {
              muscleHistory.set(muscle, []);
            }
            muscleHistory.get(muscle)!.push(e1rm);
          });
        }
      });
    });
  });

  // Kolla varje muskel för 2-3 nedgångar i rad
  let maxDeclines = 0;
  let worstMuscle: MuscleGroup | null = null;

  muscleHistory.forEach((performance, muscle) => {
    if (performance.length < 3) return; // Behöver minst 3 datapunkter

    // Räkna konsekutiva nedgångar
    let consecutiveDeclines = 0;
    for (let i = 1; i < Math.min(5, performance.length); i++) {
      if (performance[i] < performance[i - 1]) {
        consecutiveDeclines++;
      } else {
        break; // Bryt vid första ökningen
      }
    }

    if (consecutiveDeclines > maxDeclines) {
      maxDeclines = consecutiveDeclines;
      worstMuscle = muscle;
    }
  });

  if (maxDeclines >= 2) {
    return {
      needsDeload: true,
      muscle: worstMuscle,
      reason: `${worstMuscle} har försämrats ${maxDeclines} pass i rad`,
      consecutiveDeclines: maxDeclines
    };
  }

  return {
    needsDeload: false,
    muscle: null,
    reason: '',
    consecutiveDeclines: 0
  };
};

// ============================================================================
// FÖRBÄTTRAD VARIATION - Viktad över 14 dagar med decay
// ============================================================================

export interface ExerciseVariationScore {
  exerciseId: string;
  daysSinceLastUsed: number;
  usageCount: number; // Senaste 14 dagarna
  variationScore: number; // Högre = mer variation behövs
}

export const calculateVariationScores = (
  history: WorkoutSession[],
  daysBack: number = 14
): Map<string, ExerciseVariationScore> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const exerciseUsage = new Map<string, { lastUsed: Date; count: number }>();

  history.forEach(session => {
    const sessionDate = new Date(session.date);
    if (sessionDate < cutoffDate) return;

    session.exercises.forEach(sessionEx => {
      if (!exerciseUsage.has(sessionEx.exerciseId)) {
        exerciseUsage.set(sessionEx.exerciseId, {
          lastUsed: sessionDate,
          count: 0
        });
      }
      const data = exerciseUsage.get(sessionEx.exerciseId)!;
      data.count++;
      if (sessionDate > data.lastUsed) {
        data.lastUsed = sessionDate;
      }
    });
  });

  const scores = new Map<string, ExerciseVariationScore>();
  const now = new Date();

  exerciseUsage.forEach((data, exerciseId) => {
    const daysSince = Math.floor((now.getTime() - data.lastUsed.getTime()) / (1000 * 60 * 60 * 24));

    // Variation score: högre om länge sedan + låg usage count
    // Formel: (daysSince / 14) * 100 - (usageCount * 10)
    const variationScore = (daysSince / daysBack) * 100 - (data.count * 10);

    scores.set(exerciseId, {
      exerciseId,
      daysSinceLastUsed: daysSince,
      usageCount: data.count,
      variationScore: Math.max(0, variationScore) // Minst 0
    });
  });

  return scores;
};

// ============================================================================
// ANVÄNDARPREF - Tumme upp/ned för övningar (INGEN AI)
// ============================================================================

export interface ExercisePreferenceScore {
  exerciseId: string;
  preferenceScore: number; // -100 (banned), -50 (down), 0 (neutral), +50 (up)
}

export const calculatePreferenceScores = (
  allExercises: Exercise[]
): Map<string, number> => {
  const scores = new Map<string, number>();

  allExercises.forEach(exercise => {
    let score = 0;

    switch (exercise.userRating) {
      case 'up':
        score = 50;
        break;
      case 'down':
        score = -50;
        break;
      case 'banned':
        score = -100;
        break;
      default:
        score = 0;
    }

    scores.set(exercise.id, score);
  });

  return scores;
};

// ============================================================================
// SAMLAD SMART-ANALYS - För UI-visning (INGEN AI)
// ============================================================================

export interface SmartPTInsights {
  // Muskelbalans
  overloadedMuscles: { muscle: MuscleGroup; weightedSets: number }[];
  underloadedMuscles: { muscle: MuscleGroup; weightedSets: number }[];

  // Svaga muskler som behöver prioriteras
  weakMuscles: MuscleStrengthData[];
  strongMuscles: MuscleStrengthData[];

  // Deload-behov
  deloadSignal: DeloadSignal;

  // Variation - överanvända övningar
  overusedExercises: { exerciseId: string; name: string; count: number }[];
  underusedExercises: { exerciseId: string; name: string; daysSince: number }[];

  // Sammanfattande rekommendation
  topRecommendation: string;
}

export const generateSmartPTInsights = (
  history: WorkoutSession[],
  allExercises: Exercise[],
  bodyweight: number
): SmartPTInsights => {
  // Muskelsynergi
  const muscleLoad = calculateMuscleLoadSynergy(history, allExercises, 7);
  const sortedByLoad = Array.from(muscleLoad.values()).sort((a, b) => b.weightedSets - a.weightedSets);

  const overloadedMuscles = sortedByLoad.slice(0, 3).map(m => ({
    muscle: m.muscle,
    weightedSets: m.weightedSets
  }));
  const underloadedMuscles = sortedByLoad.slice(-3).reverse().map(m => ({
    muscle: m.muscle,
    weightedSets: m.weightedSets
  }));

  // Weakness
  const strengthData = detectWeakMuscles(history, allExercises, bodyweight);
  const weakMuscles = strengthData.filter(s => s.rank === 'weak').slice(0, 3);
  const strongMuscles = strengthData.filter(s => s.rank === 'strong').slice(0, 3);

  // Deload
  const deloadSignal = detectDeloadNeed(history, allExercises);

  // Variation
  const variationScores = calculateVariationScores(history, 14);
  const sortedByUsage = Array.from(variationScores.values())
    .sort((a, b) => b.usageCount - a.usageCount);

  const overusedExercises = sortedByUsage.slice(0, 3).map(v => ({
    exerciseId: v.exerciseId,
    name: allExercises.find(e => e.id === v.exerciseId)?.name || v.exerciseId,
    count: v.usageCount
  }));

  const underusedExercises = sortedByUsage
    .filter(v => v.daysSinceLastUsed >= 7)
    .slice(-3)
    .map(v => ({
      exerciseId: v.exerciseId,
      name: allExercises.find(e => e.id === v.exerciseId)?.name || v.exerciseId,
      daysSince: v.daysSinceLastUsed
    }));

  // Generera top rekommendation
  let topRecommendation = '';
  if (deloadSignal.needsDeload) {
    topRecommendation = `⚠️ ${deloadSignal.muscle} behöver vila - minska vikt 30%`;
  } else if (weakMuscles.length > 0) {
    topRecommendation = `💪 Prioritera ${weakMuscles[0].muscle} - relativ styrka är låg`;
  } else if (underloadedMuscles.length > 0 && underloadedMuscles[0].weightedSets < 5) {
    topRecommendation = `📊 ${underloadedMuscles[0].muscle} undertränad - lägg till fler övningar`;
  } else {
    topRecommendation = '✓ Balanserad träning - fortsätt så här!';
  }

  return {
    overloadedMuscles,
    underloadedMuscles,
    weakMuscles,
    strongMuscles,
    deloadSignal,
    overusedExercises,
    underusedExercises,
    topRecommendation
  };
};

// ============================================================================
// SMART ÖVNINGSRANKING - Kombinerar alla faktorer (INGEN AI)
// ============================================================================

export interface SmartExerciseScore {
  exerciseId: string;
  totalScore: number;
  breakdown: {
    userPreference: number; // -100 till +50
    muscleBalance: number; // -30 till +30
    weakness: number; // 0 till +20
    deload: number; // -50 till 0
    variation: number; // -20 till +20
  };
  recommendation: 'highly_recommended' | 'recommended' | 'neutral' | 'avoid' | 'banned';
}

export const rankExercisesBySmart = (
  allExercises: Exercise[],
  history: WorkoutSession[],
  bodyweight: number
): SmartExerciseScore[] => {
  const insights = generateSmartPTInsights(history, allExercises, bodyweight);
  const preferenceScores = calculatePreferenceScores(allExercises);
  const muscleLoad = calculateMuscleLoadSynergy(history, allExercises, 7);
  const variationScores = calculateVariationScores(history, 14);

  const scores: SmartExerciseScore[] = [];

  allExercises.forEach(exercise => {
    // 1. User preference (-100 till +50)
    const userPreference = preferenceScores.get(exercise.id) || 0;

    // Banned = instant disqualification
    if (exercise.userRating === 'banned') {
      scores.push({
        exerciseId: exercise.id,
        totalScore: -1000,
        breakdown: {
          userPreference: -100,
          muscleBalance: 0,
          weakness: 0,
          deload: 0,
          variation: 0
        },
        recommendation: 'banned'
      });
      return;
    }

    // 2. Muskelbalans (-30 till +30)
    let muscleBalance = 0;
    exercise.primaryMuscles?.forEach(muscle => {
      const load = muscleLoad.get(muscle);
      if (load) {
        // Undertränad muskel = positiv score
        if (load.weightedSets < 10) muscleBalance += 10;
        else if (load.weightedSets < 15) muscleBalance += 5;
        // Övertränad muskel = negativ score
        else if (load.weightedSets > 25) muscleBalance -= 10;
        else if (load.weightedSets > 20) muscleBalance -= 5;
      }
    });
    muscleBalance = Math.max(-30, Math.min(30, muscleBalance));

    // 3. Weakness (+0 till +20)
    let weakness = 0;
    exercise.primaryMuscles?.forEach(muscle => {
      const weakData = insights.weakMuscles.find(w => w.muscle === muscle);
      if (weakData) {
        weakness += 10; // Bonus för att träna svag muskel
      }
    });
    weakness = Math.min(20, weakness);

    // 4. Deload (-50 till 0)
    let deload = 0;
    if (insights.deloadSignal.needsDeload && insights.deloadSignal.muscle) {
      exercise.primaryMuscles?.forEach(muscle => {
        if (muscle === insights.deloadSignal.muscle) {
          deload = -50; // Stark negativ för muskel som behöver vila
        }
      });
    }

    // 5. Variation (-20 till +20)
    let variation = 0;
    const varScore = variationScores.get(exercise.id);
    if (varScore) {
      if (varScore.usageCount >= 5) variation = -20; // Använd för mycket
      else if (varScore.usageCount >= 3) variation = -10;
      else if (varScore.daysSinceLastUsed >= 14) variation = +20; // Oanvänd länge
      else if (varScore.daysSinceLastUsed >= 7) variation = +10;
    } else {
      variation = +15; // Aldrig använd = bonus
    }

    // Total score
    const totalScore = userPreference + muscleBalance + weakness + deload + variation;

    // Rekommendation
    let recommendation: SmartExerciseScore['recommendation'] = 'neutral';
    if (totalScore >= 40) recommendation = 'highly_recommended';
    else if (totalScore >= 15) recommendation = 'recommended';
    else if (totalScore <= -30) recommendation = 'avoid';

    scores.push({
      exerciseId: exercise.id,
      totalScore,
      breakdown: {
        userPreference,
        muscleBalance,
        weakness,
        deload,
        variation
      },
      recommendation
    });
  });

  // Sortera efter totalScore (högst först)
  scores.sort((a, b) => b.totalScore - a.totalScore);

  return scores;
};
