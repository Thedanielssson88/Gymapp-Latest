import { WorkoutSession } from '../types';

export interface RecoveryIndex {
  score: number; // 0-100
  muscleScore: number; // Från muskelåterhämtning
  loadScore: number; // Från training load
  timeScore: number; // Från tid sedan senaste träning
  status: 'poor' | 'fair' | 'good' | 'excellent';
  recommendation: string;
  color: string;
}

/**
 * Beräknar Recovery Index
 * Kombinerar:
 * - Muskelåterhämtning (50%)
 * - Training Load / Acute:Chronic ratio (30%)
 * - Tid sedan senaste träning (20%)
 */
export function calculateRecoveryIndex(
  muscleRecovery: number, // 0-100 (där 0 = fullt återhämtad, 100 = helt utmattad)
  acuteChronicRatio: number, // 0.8-1.3 optimal
  daysSinceLastWorkout: number
): RecoveryIndex {
  // 1. Muskel-score: Invertera så att 100 = helt återhämtad
  const muscleScore = Math.round(100 - muscleRecovery);

  // 2. Load-score: Baserat på Acute:Chronic ratio
  let loadScore = 100;
  if (acuteChronicRatio === 0) {
    loadScore = 100; // Ingen data = ingen belastning = full återhämtning
  } else if (acuteChronicRatio < 0.8) {
    loadScore = 85; // Undertränad, bra återhämtning
  } else if (acuteChronicRatio <= 1.3) {
    loadScore = 100; // Optimal zone
  } else if (acuteChronicRatio <= 1.5) {
    loadScore = 70; // Hög belastning
  } else if (acuteChronicRatio <= 1.8) {
    loadScore = 40; // Mycket hög belastning
  } else {
    loadScore = 20; // Extremt hög belastning
  }

  // 3. Tid-score: Mer tid = bättre återhämtning (max 4 dagar = 100%)
  const timeScore = Math.min(100, daysSinceLastWorkout * 25);

  // 4. Kombinera viktat
  const totalScore = Math.round(
    muscleScore * 0.50 +
    loadScore * 0.30 +
    timeScore * 0.20
  );

  // 5. Bestäm status och rekommendation
  let status: RecoveryIndex['status'];
  let recommendation: string;
  let color: string;

  if (totalScore >= 85) {
    status = 'excellent';
    recommendation = 'Redo för tung träning';
    color = '#10b981'; // green
  } else if (totalScore >= 70) {
    status = 'good';
    recommendation = 'Bra återhämtning - träna på';
    color = '#3b82f6'; // blue
  } else if (totalScore >= 50) {
    status = 'fair';
    recommendation = 'Lättare pass rekommenderas';
    color = '#f59e0b'; // orange
  } else {
    status = 'poor';
    recommendation = 'Vila eller mycket lätt aktivitet';
    color = '#ef4444'; // red
  }

  return {
    score: totalScore,
    muscleScore,
    loadScore,
    timeScore,
    status,
    recommendation,
    color
  };
}

/**
 * Beräknar hur många dagar sedan senaste träning
 */
export function getDaysSinceLastWorkout(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 7; // Default om ingen data

  // Hitta senaste träningen
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const lastWorkout = sortedSessions[0];
  const lastDate = new Date(lastWorkout.date);
  const now = new Date();

  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Beräknar muskelåterhämtning baserat på träningshistorik
 * Returnerar ett värde 0-100 där 0 = fullt återhämtad, 100 = helt utmattad
 */
export function calculateMuscleRecovery(
  sessions: WorkoutSession[],
  daysToLookBack: number = 7
): number {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysToLookBack * 24 * 60 * 60 * 1000);

  // Filtrera träningar inom perioden
  const recentSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date);
    return sessionDate >= startDate && sessionDate <= now;
  });

  if (recentSessions.length === 0) return 0; // Ingen träning = helt återhämtad

  // Räkna muskelbelastning per dag
  const muscleLoadByDay = new Map<string, number>();

  recentSessions.forEach(session => {
    const sessionDate = new Date(session.date);
    const dayKey = sessionDate.toISOString().split('T')[0];
    const daysAgo = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

    // Räkna sets per session
    const totalSets = session.exercises.reduce((sum, exercise) => {
      return sum + exercise.sets.filter(set => set.completed).length;
    }, 0);

    // RPE-viktad belastning
    const rpeWeight = (session.rpe || 5) / 10;
    const sessionLoad = totalSets * rpeWeight;

    // Decay factor: äldre träning = mindre påverkan
    // Efter 7 dagar = 0% påverkan
    const decayFactor = Math.max(0, 1 - (daysAgo / 7));
    const weightedLoad = sessionLoad * decayFactor;

    const currentLoad = muscleLoadByDay.get(dayKey) || 0;
    muscleLoadByDay.set(dayKey, currentLoad + weightedLoad);
  });

  // Summera total belastning
  const totalLoad = Array.from(muscleLoadByDay.values()).reduce((sum, load) => sum + load, 0);

  // Normalisera till 0-100 skala
  // 30 viktade sets över 7 dagar = 100% utmattad
  const maxLoad = 30;
  const recoveryScore = Math.min(100, Math.round((totalLoad / maxLoad) * 100));

  return recoveryScore;
}

/**
 * Hämtar recovery-historik för visualisering
 */
export function getRecoveryHistory(
  sessions: WorkoutSession[],
  days: number = 14
): Array<{
  date: string;
  score: number;
  status: RecoveryIndex['status'];
}> {
  const history: Array<{
    date: string;
    score: number;
    status: RecoveryIndex['status'];
  }> = [];

  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Filtrera sessions fram till detta datum
    const sessionsUpToDate = sessions.filter(session => {
      return new Date(session.date) <= date;
    });

    // Beräkna recovery för detta datum
    // (Detta är en förenkling - i verkligheten skulle vi behöva historisk A:C ratio)
    const muscleRecovery = calculateMuscleRecovery(sessionsUpToDate, 7);
    const daysSinceWorkout = getDaysSinceLastWorkout(
      sessionsUpToDate.filter(s => new Date(s.date) <= date)
    );

    // Använd förenklad recovery (utan A:C ratio för historik)
    const recoveryIndex = calculateRecoveryIndex(muscleRecovery, 1.0, daysSinceWorkout);

    history.push({
      date: dateStr,
      score: recoveryIndex.score,
      status: recoveryIndex.status
    });
  }

  return history;
}
