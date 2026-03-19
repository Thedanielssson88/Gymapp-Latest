import { WorkoutSession } from '../types';

/**
 * Beräknar daglig träningsbelastning (Training Load)
 * Baserat på duration, RPE och volym
 * Returnerar ett värde mellan 0-21 (Whoop-inspirerat)
 */
export function calculateDailyLoad(session: WorkoutSession): number {
  // Duration factor: normalize till timmar (60 min = 1.0)
  const durationFactor = (session.duration || 60) / 60;

  // RPE factor: normalize till 0-1 skala
  const rpeFactor = (session.rpe || 5) / 10;

  // Volume factor: antal completade sets, normaliserat (20 sets = 1.0)
  const completedSets = session.exercises.reduce((sum, exercise) => {
    return sum + exercise.sets.filter(set => set.completed).length;
  }, 0);
  const volumeFactor = completedSets / 20;

  // Kombinera faktorerna och skala till 0-21
  const rawLoad = (durationFactor + rpeFactor + volumeFactor) * 7;

  return Math.min(21, Math.round(rawLoad * 10) / 10);
}

/**
 * Beräknar total load för en period
 */
export function calculatePeriodLoad(sessions: WorkoutSession[]): number {
  return sessions.reduce((sum, session) => sum + calculateDailyLoad(session), 0);
}

/**
 * Beräknar Acute Load (senaste 7 dagarna)
 */
export function calculateAcuteLoad(sessions: WorkoutSession[]): number {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date);
    return sessionDate >= sevenDaysAgo && sessionDate <= now;
  });

  const totalLoad = calculatePeriodLoad(recentSessions);
  return Math.round((totalLoad / 7) * 10) / 10; // Dagligt genomsnitt
}

/**
 * Beräknar Chronic Load (senaste 28 dagarna)
 */
export function calculateChronicLoad(sessions: WorkoutSession[]): number {
  const now = new Date();
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const recentSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date);
    return sessionDate >= twentyEightDaysAgo && sessionDate <= now;
  });

  const totalLoad = calculatePeriodLoad(recentSessions);
  return Math.round((totalLoad / 28) * 10) / 10; // Dagligt genomsnitt
}

/**
 * Beräknar Acute:Chronic Ratio
 * Optimal zone: 0.8-1.3
 * >1.5 = Hög överträningsrisk
 * <0.8 = Undertränad
 */
export function calculateAcuteChronicRatio(
  acuteLoad: number,
  chronicLoad: number
): number {
  if (chronicLoad === 0) return 0;
  return Math.round((acuteLoad / chronicLoad) * 100) / 100;
}

/**
 * Analyserar Acute:Chronic ratio och ger rekommendation
 */
export function analyzeTrainingLoad(ratio: number): {
  status: 'optimal' | 'undertrained' | 'high-risk' | 'very-high-risk';
  color: string;
  message: string;
} {
  if (ratio === 0) {
    return {
      status: 'undertrained',
      color: '#94a3b8',
      message: 'Ingen träningsdata'
    };
  }

  if (ratio < 0.8) {
    return {
      status: 'undertrained',
      color: '#3b82f6',
      message: 'Låg belastning - kan öka intensitet'
    };
  }

  if (ratio >= 0.8 && ratio <= 1.3) {
    return {
      status: 'optimal',
      color: '#10b981',
      message: 'Optimal träningsbalans'
    };
  }

  if (ratio > 1.3 && ratio <= 1.5) {
    return {
      status: 'high-risk',
      color: '#f59e0b',
      message: 'Hög belastning - var försiktig'
    };
  }

  return {
    status: 'very-high-risk',
    color: '#ef4444',
    message: 'Mycket hög risk - minska belastning'
  };
}

/**
 * Beräknar daglig load-historik för senaste N dagar
 */
export function getDailyLoadHistory(
  sessions: WorkoutSession[],
  days: number = 28
): Array<{ date: string; load: number }> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Skapa en map med datum som nyckel
  const loadByDate = new Map<string, number>();

  // Initialisera alla dagar med 0
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    loadByDate.set(dateStr, 0);
  }

  // Lägg till faktisk load för dagar med träning
  sessions.forEach(session => {
    const sessionDate = new Date(session.date);
    if (sessionDate >= startDate && sessionDate <= now) {
      const dateStr = session.date.split('T')[0];
      const currentLoad = loadByDate.get(dateStr) || 0;
      loadByDate.set(dateStr, currentLoad + calculateDailyLoad(session));
    }
  });

  // Konvertera till array och sortera
  return Array.from(loadByDate.entries())
    .map(([date, load]) => ({ date, load: Math.round(load * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
