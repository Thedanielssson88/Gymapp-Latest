
import { WorkoutSession, Exercise, MuscleGroup } from '../types';

/**
 * Beräknar total träningsvolym (set * reps * vikt) per muskelgrupp.
 */
export const calculateVolumeByMuscleGroup = (
  history: WorkoutSession[],
  allExercises: Exercise[]
): Record<string, number> => {
  const volumeMap: Record<string, number> = {};

  history.forEach(session => {
    session.exercises.forEach(plannedEx => {
      const exData = allExercises.find(e => e.id === plannedEx.exerciseId);
      if (!exData) return;

      const sessionVolume = plannedEx.sets
        .filter(s => s.completed)
        .reduce((sum, set) => sum + ((set.reps || 0) * (set.weight || 0)), 0);

      const allMuscles = new Set([
        ...exData.primaryMuscles,
        ...(exData.secondaryMuscles || [])
      ]);

      allMuscles.forEach(muscle => {
        volumeMap[muscle] = (volumeMap[muscle] || 0) + sessionVolume;
      });
    });
  });

  return volumeMap;
};

/**
 * Analyserar regelbundenheten i träningen baserat på vilodagar.
 */
export const analyzeConsistency = (history: WorkoutSession[]): { 
  avgRestDays: number;
  minRestDays: number;
  maxRestDays: number;
  summary: string; 
} => {
  if (history.length < 2) {
    return { avgRestDays: 0, minRestDays: 0, maxRestDays: 0, summary: "För lite data för att analysera." };
  }

  const sortedSessions = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const restDays: number[] = [];
  for (let i = 1; i < sortedSessions.length; i++) {
    const prev = new Date(sortedSessions[i - 1].date);
    const curr = new Date(sortedSessions[i].date);
    const diffTime = Math.abs(curr.getTime() - prev.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    restDays.push(diffDays - 1); // -1 because we want days *between* workouts
  }

  if (restDays.length === 0) {
    return { avgRestDays: 0, minRestDays: 0, maxRestDays: 0, summary: "Tränar bara en gång?" };
  }

  const avgRestDays = restDays.reduce((a, b) => a + b, 0) / restDays.length;
  const minRestDays = Math.min(...restDays);
  const maxRestDays = Math.max(...restDays);
  
  let summary = "Regelbunden";
  const variance = Math.abs(maxRestDays - minRestDays);
  if (variance > 3) summary = "Oregelbunden";
  if (avgRestDays > 4) summary = "Gles";

  return {
    avgRestDays: parseFloat(avgRestDays.toFixed(1)),
    minRestDays,
    maxRestDays,
    summary
  };
};
