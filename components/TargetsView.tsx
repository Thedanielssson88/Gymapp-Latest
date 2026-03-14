
import React, { useState, useMemo, useEffect } from 'react';
import { 
  WorkoutSession, 
  Exercise, 
  UserMission,
  UserProfile,
  BiometricLog,
  BodyMeasurements,
  MuscleGroup,
  MovementPattern
} from '../types';
import { 
  Trophy, Target as TargetIcon, TrendingUp, Plus, Zap, Star, Flame, Award, X, Check, Dumbbell,
  Sunrise, Moon, CalendarDays, Link, CalendarCheck, Crown, Weight, Globe, Gem, Timer, Wind,
  RotateCcw, Hourglass, Layers, Compass, MapPin, ArrowUp, ArrowDown, Anchor, Shield, Swords, MessageSquare,
  Medal, Lock, AlertTriangle, Trash2, Calendar
} from 'lucide-react';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer 
} from 'recharts';
import { calculate1RM, getLastPerformance } from '../utils/fitness';
import { AddMissionModal } from './AddMissionModal';
import { MissionStatusModal } from './MissionStatusModal';
import { calculateSmartProgression } from '../utils/progression';
import { ALL_MUSCLE_GROUPS } from '../utils/recovery';
import { registerBackHandler } from '../utils/backHandler';

interface TargetsViewProps {
  userMissions: UserMission[];
  history: WorkoutSession[];
  exercises: Exercise[];
  userProfile: UserProfile;
  biometricLogs: BiometricLog[];
  onAddMission: (mission: UserMission) => void;
  onDeleteMission: (id: string) => void;
}

// Referensvärden för 100 poäng (Elit-nivå)
const REF_MAX = { PUSH: 120, PULL: 220, LEGS: 180 }; 

// Hjälpfunktion för att sortera in övningar i PPL
const getPPLCategory = (ex: Exercise): 'Push' | 'Pull' | 'Legs' | 'Other' => {
  if (ex.pattern === MovementPattern.HORIZONTAL_PUSH || ex.pattern === MovementPattern.VERTICAL_PUSH) return 'Push';
  if (ex.pattern === MovementPattern.HORIZONTAL_PULL || ex.pattern === MovementPattern.HINGE) return 'Pull';
  if (ex.pattern === MovementPattern.SQUAT || ex.pattern === MovementPattern.LUNGE) return 'Legs';
  
  const p = ex.primaryMuscles || [];
  if (p.includes('Bröst') || p.includes('Triceps') || p.includes('Axlar')) return 'Push';
  if (p.includes('Rygg') || p.includes('Biceps') || p.includes('Trapezius')) return 'Pull';
  if (p.includes('Framsida lår') || p.includes('Baksida lår') || p.includes('Säte') || p.includes('Vader')) return 'Legs';
  
  return 'Other';
};

const getMuscleGroupsTrainedInPeriod = (
  sessions: WorkoutSession[],
  exercisesMeta: Exercise[],
  days: number,
  now: Date
): Set<MuscleGroup> => {
  const cutoffDate = new Date(now);
  cutoffDate.setDate(now.getDate() - days);

  const trainedMuscles = new Set<MuscleGroup>();

  (sessions || []).filter(s => new Date(s.date) >= cutoffDate).forEach(session => {
    (session.exercises || []).forEach(plannedEx => {
      const exData = exercisesMeta.find(e => e.id === plannedEx.exerciseId);
      if (exData) {
        exData.primaryMuscles.forEach(m => trainedMuscles.add(m));
        exData.secondaryMuscles?.forEach(m => trainedMuscles.add(m));
      }
    });
  });
  return trainedMuscles;
};

const getProgressStats = (mission: UserMission, currentValues: Record<string, number>) => {
    if (mission.type !== 'smart_goal' || !mission.smartConfig) {
        const percent = mission.total > 0 ? Math.min(100, Math.max(0, Math.round((mission.progress / mission.total) * 100))) : 0;
        return { percent, isBehind: false, timePercent: 0 };
    }

    const config = mission.smartConfig;
    const current = currentValues[mission.id] || config.startValue;
    
    let percent = 0;
    const totalDist = Math.abs(config.targetValue - config.startValue);
    if (totalDist > 0) {
        if (config.targetValue > config.startValue) {
            // Increasing goal
            percent = ((current - config.startValue) / totalDist) * 100;
        } else {
            // Decreasing goal
            percent = ((config.startValue - current) / totalDist) * 100;
        }
    }
    percent = Math.min(100, Math.max(0, Math.round(percent)));

    let timePercent = 0;
    let isBehind = false;

    if (config.deadline) {
        const start = new Date(mission.createdAt!).getTime();
        const end = new Date(config.deadline).getTime();
        const now = new Date().getTime();
        const totalTime = end - start;
        
        if (totalTime > 0) {
            timePercent = Math.min(100, Math.max(0, ((now - start) / totalTime) * 100));
        }

        if (timePercent > (percent + 10) && percent < 100) {
            isBehind = true;
        }
    }

    return { percent, isBehind, timePercent };
};

export const TargetsView: React.FC<TargetsViewProps> = ({
  userMissions, history, exercises, userProfile, biometricLogs, onAddMission, onDeleteMission
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingMission, setViewingMission] = useState<UserMission | null>(null);
  
  useEffect(() => {
    if (viewingMission || showAddModal) {
      return registerBackHandler(() => {
        setViewingMission(null);
        setShowAddModal(false);
      });
    }
  }, [viewingMission, showAddModal]);

  const currentValues = useMemo(() => {
    const newValues: Record<string, number> = {};
    if (!userMissions || !userProfile) return newValues;

    for (const m of userMissions) {
      if (m.type === 'smart_goal' && m.smartConfig) {
        if (m.smartConfig.targetType === 'exercise' && m.smartConfig.exerciseId) {
          const lastPerf = getLastPerformance(m.smartConfig.exerciseId, history);
          const max = lastPerf ? Math.max(...lastPerf.map(s => calculate1RM(s.weight, s.reps))) : 0;
          newValues[m.id] = max > 0 ? max : m.smartConfig.startValue;
        } else if (m.smartConfig.targetType === 'body_weight') {
          const latestLog = [...biometricLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          newValues[m.id] = latestLog?.weight || userProfile.weight || m.smartConfig.startValue;
        } else if (m.smartConfig.targetType === 'body_measurement' && m.smartConfig.measurementKey) {
          const key = m.smartConfig.measurementKey;
          const latestLog = [...biometricLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(l => l.measurements?.[key as keyof BodyMeasurements]);
          newValues[m.id] = latestLog?.measurements?.[key as keyof BodyMeasurements] || userProfile.measurements?.[key as keyof BodyMeasurements] || m.smartConfig.startValue;
        }
      }
    }
    return newValues;
  }, [userMissions, history, biometricLogs, userProfile]);

  const stats = useMemo(() => {
      const totalWorkouts = (history || []).length;
      let totalSets = 0;
      let totalImpactXP = 0;

      (history || []).forEach(session => {
        (session.exercises || []).forEach(plannedEx => {
          const exData = (exercises || []).find(e => e.id === plannedEx.exerciseId);
          if (!exData) return;

          const completedSets = (plannedEx.sets || []).filter(s => s.completed);
          totalSets += completedSets.length;

          completedSets.forEach(set => {
            const trackingType = exData.trackingType || 'reps_weight';
            let setImpact = 0;
            const userWeight = userProfile?.weight || 80;
            
            switch(trackingType) {
                case 'time_only':
                case 'time_distance':
                    const timeBasedBwFactor = exData.bodyweightCoefficient || 0.5;
                    const timeVolume = (set.duration || 0) * userWeight * timeBasedBwFactor * 0.1;
                    setImpact = timeVolume * (exData.difficultyMultiplier || 1);
                    break;
                case 'reps_only':
                    const repBasedBwFactor = exData.bodyweightCoefficient || 0.7;
                    setImpact = userWeight * repBasedBwFactor * (set.reps || 0) * (exData.difficultyMultiplier || 1);
                    break;
                case 'reps_weight':
                default:
                    const bodyweightLoad = (exData.bodyweightCoefficient || 0) * userWeight;
                    const effectiveLoad = bodyweightLoad + (set.weight || 0);
                    setImpact = effectiveLoad * (set.reps || 0) * (exData.difficultyMultiplier || 1);
                    break;
            }
            totalImpactXP += setImpact / 100;
          });
        });
      });

      const totalXP = (totalWorkouts * 50) + (totalSets * 10) + totalImpactXP;

      const calculateLevelData = (xp: number) => {
        let currentLvl = 1;
        let totalXpThreshold = 0;
        let xpForNext = 200;

        while (true) {
            if (currentLvl < 6) xpForNext = 200;
            else if (currentLvl < 16) xpForNext = 500;
            else xpForNext = Math.round(Math.pow(currentLvl, 1.5) * 100);

            if (xp < totalXpThreshold + xpForNext) break;

            totalXpThreshold += xpForNext;
            currentLvl++;
        }

        const xpEarnedInLevel = Math.round(xp - totalXpThreshold);
        const progress = (xpForNext > 0) ? (xpEarnedInLevel / xpForNext) * 100 : 0;

        return {
          level: currentLvl,
          xpProgress: progress,
          currentLevelXP: xpEarnedInLevel,
          xpToNextLevel: xpForNext,
        };
      };

      const levelData = calculateLevelData(totalXP);
      const sortedHistory = [...(history || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let currentStreak = 0;
      if (sortedHistory.length > 0) {
        const today = new Date(); today.setHours(0,0,0,0);
        let currentStreakCount = 0;
        let lastConsideredDate: Date | null = null;
        for (let i = sortedHistory.length - 1; i >= 0; i--) {
          const workoutDate = new Date(sortedHistory[i].date); workoutDate.setHours(0, 0, 0, 0);
          if (lastConsideredDate === null) {
            const daysAgo = (today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysAgo === 0 || daysAgo === 1) { currentStreakCount = 1; lastConsideredDate = workoutDate; } 
            else { break; }
          } else {
            const daysDiff = (lastConsideredDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff === 1) { currentStreakCount++; lastConsideredDate = workoutDate; } 
            else if (daysDiff > 1) { break; }
          }
        }
        currentStreak = currentStreakCount;
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(new Date().getMonth() - 6);
      const recentHistory = history.filter(s => new Date(s.date) >= sixMonthsAgo);

      let maxPush = 0, maxPull = 0, maxLegs = 0;

      recentHistory.forEach(sess => {
         sess.exercises.forEach(pe => {
            const ex = exercises.find(e => e.id === pe.exerciseId);
            if (ex) {
               const cat = getPPLCategory(ex);
               const exerciseMax = Math.max(...pe.sets.filter(s => s.completed && s.weight > 0).map(s => calculate1RM(s.weight, s.reps)), 0);
               
               if (exerciseMax > 0) {
                  if (cat === 'Push') maxPush = Math.max(maxPush, exerciseMax);
                  if (cat === 'Pull') maxPull = Math.max(maxPull, exerciseMax);
                  if (cat === 'Legs') maxLegs = Math.max(maxLegs, exerciseMax);
               }
            }
         });
      });

      const pushScore = Math.min(100, Math.round((maxPush / REF_MAX.PUSH) * 100));
      const pullScore = Math.min(100, Math.round((maxPull / REF_MAX.PULL) * 100));
      const legsScore = Math.min(100, Math.round((maxLegs / REF_MAX.LEGS) * 100));
      const totalPowerScore = Math.round((pushScore + pullScore + legsScore) / 3);

      const radarData = [
          { subject: 'Push', A: pushScore, fullMark: 100 },
          { subject: 'Pull', A: pullScore, fullMark: 100 },
          { subject: 'Legs', A: legsScore, fullMark: 100 },
      ];

      return { 
        totalWorkouts, totalSets, totalXP: Math.round(totalXP), 
        ...levelData, impactBonus: Math.round(totalImpactXP), streak: currentStreak,
        pushScore, pullScore, legsScore, totalPowerScore, radarData
      };
    }, [history, exercises, userProfile]);

  const achievedMilestones = useMemo(() => {
    const now = new Date();
    const allSets = (history || []).flatMap(s => (s.exercises || []).flatMap(e => (e.sets || []).filter(set => set.completed).map(set => ({ ...set, sessionId: s.id, exerciseId: e.exerciseId, date: s.date }))));
    const totalVolume = allSets.reduce((acc, s) => acc + ((s.weight || 0) * (s.reps || 0)), 0);
    const totalDistance = allSets.reduce((acc, s) => acc + (s.distance || 0), 0);
    const totalDurationMin = (history || []).reduce((acc, s) => acc + (s.duration || 0), 0) / 60;
    const uniqueExercises = new Set(allSets.map(s => s.exerciseId));
    const uniqueZones = new Set((history || []).map(s => s.zoneId));
    const getPattern = (id: string) => (exercises || []).find(e => e.id === id)?.pattern;
    const musclesTrainedLast7Days = getMuscleGroupsTrainedInPeriod(history || [], exercises || [], 7, now);
    const importantMuscles = new Set<MuscleGroup>(ALL_MUSCLE_GROUPS.filter(m => !['Hela kroppen', 'Rörlighet', 'Balans', 'Greppstyrka', 'Rotatorcuff', 'Tibialis', 'Nacke', 'Bröstrygg', 'Underarmar'].includes(m))); 
    const achievedAllEater = importantMuscles.size > 0 && Array.from(importantMuscles).every(m => musclesTrainedLast7Days.has(m));

    const milestones = [
      { id: 1, name: 'Gryningskrigare', desc: '5 pass före kl 07:00', icon: <Sunrise size={24}/>, achieved: (history || []).filter(s => new Date(s.date).getHours() < 7).length >= 5 },
      { id: 2, name: 'Nattugglan', desc: '5 pass efter kl 21:00', icon: <Moon size={24}/>, achieved: (history || []).filter(s => new Date(s.date).getHours() >= 21).length >= 5 },
      { id: 3, name: 'Helgkrigaren', desc: 'Pass både lördag och söndag', icon: <CalendarDays size={24}/>, achieved: (history || []).some(s => { const d = new Date(s.date); if (d.getDay() !== 0) return false; const prevDay = new Date(d); prevDay.setDate(d.getDate() - 1); return (history || []).some(hs => new Date(hs.date).toDateString() === prevDay.toDateString() && prevDay.getDay() === 6); }) },
      { id: 4, name: 'Obruten Kedja', desc: 'Tränat 4 veckor i rad', icon: <Link size={24}/>, achieved: stats.streak >= 4 }, 
      { id: 5, name: 'Månadens Maskin', desc: '15 pass på en kalendermånad', icon: <CalendarCheck size={24}/>, achieved: (history || []).filter(s => new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === now.getFullYear()).length >= 15 },
      { id: 6, name: 'Veteranen', desc: '100 träningspass loggade', icon: <Award size={24}/>, achieved: (history || []).length >= 100 },
      { id: 7, name: 'Legenden', desc: '500 träningspass loggade', icon: <Crown size={24}/>, achieved: (history || []).length >= 500 },
      { id: 8, name: 'Järngreppet', desc: 'Lyft totalt 10 ton', icon: <Weight size={24}/>, achieved: totalVolume >= 10000 },
      { id: 9, name: 'Gudfader av Järn', desc: 'Lyft totalt 100 ton', icon: <Zap size={24}/>, achieved: totalVolume >= 100000 },
      { id: 10, name: 'Planetens Tyngd', desc: 'Lyft totalt 1 000 ton', icon: <Globe size={24}/>, achieved: totalVolume >= 1000000 },
      { id: 11, name: '100-klubben', desc: 'Första setet på 100 kg+', icon: <Trophy size={24}/>, achieved: allSets.some(s => s.weight >= 100) },
      { id: 12, name: 'Titanlyftet', desc: 'Första setet på 200 kg+', icon: <Gem size={24}/>, achieved: allSets.some(s => s.weight >= 200) },
      { id: 13, name: 'Bänkpress-beast', desc: '50 set Bänkpress', icon: <Dumbbell size={24}/>, achieved: allSets.filter(s => (exercises || []).find(ex => ex.id === s.exerciseId)?.name.toLowerCase().includes('bänkpress')).length >= 50 },
      { id: 14, name: 'Knäböjs-kung', desc: '50 set Knäböj', icon: <Dumbbell size={24}/>, achieved: allSets.filter(s => (exercises || []).find(ex => ex.id === s.exerciseId)?.name.toLowerCase().includes('knäböj')).length >= 50 },
      { id: 15, name: 'Marklyfts-monster', desc: '50 set Marklyft', icon: <Dumbbell size={24}/>, achieved: allSets.filter(s => (exercises || []).find(ex => ex.id === s.exerciseId)?.name.toLowerCase().includes('marklyft')).length >= 50 },
      { id: 16, name: 'Maratonlöparen', desc: 'Sprungit 42.2 km totalt', icon: <Timer size={24}/>, achieved: totalDistance >= 42200 },
      { id: 17, name: 'Vindsnabba Steg', desc: '10 loggade löppass', icon: <Wind size={24}/>, achieved: (history || []).filter(s => s.exercises && s.exercises.some(e => (exercises || []).find(ex => ex.id === e.exerciseId)?.pattern === MovementPattern.CARDIO)).length >= 10 },
      { id: 18, name: 'Rep-maskinen', desc: 'Gjort ett set med 30+ reps', icon: <RotateCcw size={24}/>, achieved: allSets.some(s => s.reps >= 30) },
      { id: 19, name: 'Volym-frossa', desc: 'Ett pass med 10 ton+ volym', icon: <TrendingUp size={24}/>, achieved: (history || []).some(s => (s.exercises || []).flatMap(e => e.sets || []).reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0) >= 10000) },
      { id: 20, name: 'Tidsresenären', desc: '100 timmar total träningstid', icon: <Hourglass size={24}/>, achieved: totalDurationMin >= 6000 },
      { id: 21, name: 'Allätaren', desc: 'Tränat alla viktiga muskelgrupper på 7 dagar', icon: <Layers size={24}/>, achieved: achievedAllEater }, 
      { id: 22, name: 'Upptäcktsresande', desc: 'Testat 30 unika övningar', icon: <Compass size={24}/>, achieved: uniqueExercises.size >= 30 },
      { id: 23, name: 'Zon-vandrare', desc: 'Tränat på 5 olika gym/platser', icon: <MapPin size={24}/>, achieved: uniqueZones.size >= 5 },
      { id: 24, name: 'Pattern Master (Push)', desc: '100 set press-övningar', icon: <ArrowUp size={24}/>, achieved: allSets.filter(s => getPattern(s.exerciseId)?.includes('Push')).length >= 100 },
      { id: 25, name: 'Pattern Master (Pull)', desc: '100 set drag-övningar', icon: <ArrowDown size={24}/>, achieved: allSets.filter(s => getPattern(s.exerciseId)?.includes('Pull')).length >= 100 },
      { id: 26, name: 'Leg Day Hero', desc: '100 set ben-övningar', icon: <Anchor size={24}/>, achieved: allSets.filter(s => getPattern(s.exerciseId) === MovementPattern.SQUAT || getPattern(s.exerciseId) === MovementPattern.LUNGE).length >= 100 },
      { id: 27, name: 'Ondskefull Core', desc: '100 set bålträning', icon: <Shield size={24}/>, achieved: allSets.filter(s => getPattern(s.exerciseId) === MovementPattern.CORE).length >= 100 },
      { id: 28, name: 'Intensitets-missbrukare', desc: '20 set med RPE 10', icon: <Flame size={24}/>, achieved: allSets.filter(s => s.rpe === 10).length >= 20 },
      { id: 29, name: 'Blixten', desc: 'Pass (5+ övn) under 30 min', icon: <Zap size={24}/>, achieved: (history || []).some(s => s.exercises && s.exercises.length >= 5 && s.duration && s.duration < 1800) },
      { id: 30, name: 'Gladiatordoppet', desc: 'Pass längre än 120 minuter', icon: <Swords size={24}/>, achieved: (history || []).some(s => s.duration && s.duration > 7200) },
    ];
    return milestones.filter(m => m.achieved);
  }, [history, exercises, stats, userProfile, biometricLogs]);

  return (
    <div className="pb-32 space-y-8 animate-in fade-in px-4 pt-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a1721] to-[#25212d] rounded-[32px] p-6 border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={120} /></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-accent-pink flex items-center justify-center shadow-[0_0_20px_rgba(255,45,85,0.4)]">
              <span className="text-3xl font-black italic text-white leading-none">{stats.level}</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white text-black text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">LVL</div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-col">
              <h3 className="text-xl font-black italic uppercase text-white leading-tight">Warrior Status</h3>
              <span className="text-[10px] font-black text-text-dim uppercase tracking-widest mt-0.5">{stats.currentLevelXP} / {stats.xpToNextLevel} XP</span>
            </div>
            <div className="pt-1">
               <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 animate-pulse" style={{ animationDuration: '3s' }} />
                  <div className="h-full bg-gradient-to-r from-accent-blue to-purple-500 transition-all duration-1000 ease-out relative" style={{ width: `${stats.xpProgress}%` }}><div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50" /></div>
              </div>
              <p className="text-[10px] text-text-dim mt-2 text-right">{stats.xpToNextLevel - stats.currentLevelXP} XP kvar till nästa nivå</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
          <div className="text-center"><p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">Pass</p><p className="text-xl font-black text-white italic">{stats.totalWorkouts}</p></div>
          <div className="text-center border-x border-white/5"><p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">Power XP</p><p className="text-xl font-black text-accent-blue italic">+{stats.impactBonus}</p></div>
          <div className="text-center"><p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">Streak</p><div className="flex items-center justify-center gap-1"><Flame size={16} className="text-orange-500" /><p className="text-xl font-black text-white italic">{stats.streak}</p></div></div>
        </div>
      </section>

      <section className="bg-[#1a1721] rounded-[32px] border border-white/5 p-6 relative overflow-hidden shadow-xl">
         <div className="flex justify-between items-center mb-2 relative z-10"><h3 className="text-lg font-black italic uppercase text-white flex items-center gap-2"><Shield size={18} className="text-accent-blue" /> Power Stats</h3><span className="text-[10px] text-text-dim font-bold uppercase tracking-widest">0-100 Scale</span></div>
         <div className="h-64 w-full -ml-2"><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats.radarData}><PolarGrid stroke="#ffffff10" /><PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 11, fontWeight: 900, dy: 3 }} /><PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} /><Radar name="Score" dataKey="A" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.3} /></RadarChart></ResponsiveContainer></div>
         <div className="grid grid-cols-3 gap-3 mt-2 mb-6">{[{ label: 'PUSH', val: stats.pushScore, color: 'text-accent-blue', icon: Swords }, { label: 'PULL', val: stats.pullScore, color: 'text-accent-green', icon: TargetIcon }, { label: 'LEGS', val: stats.legsScore, color: 'text-accent-pink', icon: Zap }].map((s) => (<div key={s.label} className="bg-white/5 rounded-2xl p-3 flex flex-col items-center border border-white/5"><s.icon size={14} className={`mb-2 ${s.color}`} /><span className="text-xl font-black text-white italic leading-none">{s.val}</span><span className="text-[8px] font-black uppercase text-text-dim mt-1">{s.label}</span></div>))}</div>
         <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue"><Crown size={20} /></div><div><h4 className="text-sm font-black uppercase text-white">Total Strength</h4><p className="text-[10px] text-text-dim uppercase tracking-widest">Genomsnittlig poäng</p></div></div><div className="text-right"><span className="text-3xl font-black italic text-white">{stats.totalPowerScore}</span><span className="text-xs font-bold text-text-dim"> / 100</span></div></div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2"><TargetIcon size={18} className="text-accent-blue" /><h3 className="text-xs font-black uppercase text-white tracking-widest">Aktiva Uppdrag</h3></div>
          <button onClick={() => setShowAddModal(true)} className="p-2 bg-accent-blue/10 text-accent-blue rounded-xl hover:bg-accent-blue/20 transition-colors"><Plus size={20} /></button>
        </div>
        <div className="grid gap-4">
          {userMissions.length === 0 ? (
            <div className="py-8 text-center bg-white/5 rounded-[32px] border border-dashed border-white/10 opacity-50"><p className="text-[10px] font-black uppercase tracking-widest">Inga aktiva uppdrag</p></div>
          ) : (
            userMissions.map(mission => {
              if (mission.isCompleted) return null;
              const isSmart = mission.type === 'smart_goal';
              const { percent, isBehind, timePercent } = getProgressStats(mission, currentValues);

              return (
                <div key={mission.id} onClick={() => isSmart && setViewingMission(mission)} className={`bg-[#1a1721] p-5 rounded-2xl border border-white/5 relative group transition-all ${isSmart ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSmart ? 'bg-accent-blue/10 text-accent-blue' : 'bg-purple-500/10 text-purple-500'}`}>
                        {isSmart ? <TrendingUp size={20} /> : <Trophy size={20} />}
                      </div>
                      <div className="min-w-0"><h3 className="text-white font-bold text-base leading-tight line-clamp-2">{mission.title}</h3>{mission.smartConfig?.deadline && (<p className="text-xs text-text-dim flex items-center gap-1 mt-1"><Calendar size={10} /> Deadline: {mission.smartConfig.deadline}</p>)}</div>
                    </div>
                    <button onClick={(e) => {e.stopPropagation(); onDeleteMission(mission.id);}} className="p-2 text-text-dim hover:text-red-500 hover:bg-white/5 rounded-full transition-colors"><Trash2 size={18} /></button>
                  </div>

                  {isSmart ? (
                    <>
                      <div className="space-y-1 mb-2"><div className="flex justify-between text-xs font-bold uppercase"><span className="text-white">Måluppfyllelse</span><span className={percent >= 100 ? 'text-accent-green' : 'text-accent-blue'}>{percent}%</span></div><div className="h-3 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${percent >= 100 ? 'bg-accent-green' : 'bg-accent-blue'}`} style={{ width: `${percent}%` }} /></div></div>
                      {mission.smartConfig?.deadline && (<div className="space-y-1 mt-3"><div className="flex justify-between text-[10px] font-bold uppercase text-text-dim"><span className="flex items-center gap-1">Tidslinje {isBehind && <AlertTriangle size={10} className="text-red-500" />}</span><span>{Math.round(timePercent)}% av tiden</span></div><div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${isBehind ? 'bg-red-500' : 'bg-white/30'}`} style={{ width: `${timePercent}%` }}/></div>{isBehind && (<p className="text-[9px] text-red-500 font-bold mt-1 text-right">Du ligger efter planen!</p>)}</div>)}
                    </>
                  ) : (
                    <div className="flex items-center gap-4 mt-2">
                       <button onClick={() => onAddMission({...mission, isCompleted: true, completedAt: new Date().toISOString()})} className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl text-text-dim hover:bg-accent-green/20 hover:text-accent-green transition-all"><Check size={24}/></button>
                       <div className="flex-1"><p className="text-xs text-text-dim uppercase font-bold tracking-widest">Markera som slutfört</p></div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-2"><Star size={18} className="text-yellow-500" /><h3 className="text-xs font-black uppercase text-white tracking-widest">Uppnådda Prestationer ({achievedMilestones.length})</h3></div>
        {achievedMilestones.length === 0 ? (<div className="py-12 text-center bg-white/5 rounded-[32px] border border-dashed border-white/10 opacity-30"><Swords size={40} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Ge dig ut i strid för att<br/>låsa upp din första prestation</p></div>) : (<div className="grid grid-cols-1 gap-3">{achievedMilestones.map(m => (<div key={m.id} className="bg-[#1a1721] p-4 rounded-[28px] border border-yellow-500/20 flex items-center gap-4 animate-in zoom-in-95 shadow-lg shadow-yellow-500/5"><div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">{m.icon}</div><div><h4 className="text-sm font-black text-white uppercase italic leading-none mb-1">{m.name}</h4><p className="text-[9px] text-text-dim uppercase font-bold tracking-tight">{m.desc}</p></div><div className="ml-auto"><div className="bg-yellow-500 p-1 rounded-full"><Check size={12} strokeWidth={4} className="text-black" /></div></div></div>))}</div>)}
      </section>

      {showAddModal && <AddMissionModal allExercises={exercises} userProfile={userProfile} history={history} onSave={(mission) => { onAddMission(mission); setShowAddModal(false); }} onClose={() => setShowAddModal(false)} />}
      {viewingMission && <MissionStatusModal mission={viewingMission} onClose={() => setViewingMission(null)} />}
    </div>
  );
};
