
import React, { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid, BarChart, Bar, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { WorkoutSession, Exercise, BiometricLog, UserProfile, MuscleGroup } from '../types';
import { calculateMuscleRecovery, ALL_MUSCLE_GROUPS } from '../utils/recovery';
import { calculate1RM } from '../utils/fitness';
import { storage } from '../services/storage';
import { Zap, ShieldAlert, AlertTriangle, LayoutList, Map as MapIcon, BarChart2, TrendingUp, Calendar, Dumbbell } from 'lucide-react';
import { RecoveryMap } from './RecoveryMap';

// --- HJÄLPFUNKTIONER FÖR STATISTIK ---
const filterDataByRange = (data: any[], dateKey: string, range: string) => {
  const now = new Date();
  const subMonths = (d: Date, m: number) => {
    const newD = new Date(d);
    newD.setMonth(d.getMonth() - m);
    return newD;
  };
  let cutoff = new Date(0);
  if (range === '1M') cutoff = subMonths(new Date(), 1);
  else if (range === '3M') cutoff = subMonths(new Date(), 3);
  else if (range === '6M') cutoff = subMonths(new Date(), 6);
  else if (range === '1Y') cutoff = subMonths(new Date(), 12);
  return data.filter(item => new Date(item[dateKey]) >= cutoff);
};

const formatDate = (dateStr: string) => 
  new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

// --- HUVUDKOMPONENT ---
interface StatsViewProps {
  logs: BiometricLog[];
  history: WorkoutSession[];
  allExercises: Exercise[];
  userProfile: UserProfile;
  onUpdateProfile: () => void;
  initialMode?: 'recovery' | 'analytics';
}

export const StatsView: React.FC<StatsViewProps> = ({ 
  logs, history, allExercises, userProfile, onUpdateProfile, initialMode = 'recovery'
}) => {
  const [activeTab, setActiveTab] = useState<'recovery' | 'injuries' | 'analytics'>(initialMode === 'analytics' ? 'analytics' : 'recovery');
  const [timeRange, setTimeRange] = useState('3M');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  
  // Sync if initialMode changes externally (e.g. from App.tsx navigation)
  useEffect(() => {
    if (initialMode === 'analytics') setActiveTab('analytics');
    else if (initialMode === 'recovery' && activeTab === 'analytics') setActiveTab('recovery');
  }, [initialMode]);

  const recoveryScores = useMemo(() => calculateMuscleRecovery(history, allExercises, userProfile), [history, allExercises, userProfile]);

  const toggleInjury = async (muscle: MuscleGroup) => {
    const currentInjuries = userProfile.injuries || [];
    const newInjuries = currentInjuries.includes(muscle) ? currentInjuries.filter(m => m !== muscle) : [...currentInjuries, muscle];
    await storage.setUserProfile({ ...userProfile, injuries: newInjuries });
    onUpdateProfile();
  };
  
  const exercisesWithHistory = useMemo(() => {
    const performedExerciseIds = new Set(
      history.flatMap(sess => sess.exercises.map(e => e.exerciseId))
    );
    return allExercises.filter(ex => performedExerciseIds.has(ex.id));
  }, [allExercises, history]);

  useEffect(() => {
    if (!selectedExerciseId && exercisesWithHistory.length > 0) {
      setSelectedExerciseId(exercisesWithHistory[0].id);
    }
  }, [exercisesWithHistory, selectedExerciseId]);

  // --- STATISTIK DATA ---
  const analyticsData = useMemo(() => {
    if (activeTab !== 'analytics') return null;

    const filteredHistory = filterDataByRange(history, 'date', timeRange);
    const filteredLogs = filterDataByRange(logs, 'date', timeRange).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 1. Volym & Pass
    const totalVolume = filteredHistory.reduce((acc, sess) => acc + sess.exercises.reduce((sAcc, ex) => sAcc + ex.sets.filter(s => s.completed).reduce((rAcc, s) => rAcc + (s.weight * s.reps), 0), 0), 0);
    
    // 2. Veckoaktivitet
    const weekMap: Record<string, number> = {};
    filteredHistory.forEach(s => {
       const d = new Date(s.date);
       const key = `v.${Math.ceil(d.getDate() / 7)}`;
       weekMap[key] = (weekMap[key] || 0) + 1;
    });
    const weeklyData = Object.entries(weekMap).map(([name, count]) => ({ name, count })).slice(-8);

    // 3. Viktkurva
    const weightData = filteredLogs.map(log => ({ date: formatDate(log.date), weight: log.weight }));

    // 4. 1RM för vald övning
    const strengthData: any[] = [];
    if (selectedExerciseId) {
      filteredHistory.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(sess => {
         const ex = sess.exercises.find(e => e.exerciseId === selectedExerciseId);
         if(ex) {
            const max1RM = Math.max(...ex.sets.filter(s => s.completed).map(s => calculate1RM(s.weight, s.reps)), 0);
            if (max1RM > 0) strengthData.push({ date: formatDate(sess.date), oneRM: Math.round(max1RM) });
         }
      });
    }

    // 5. Muskelbalans (Radar)
    const muscleCounts: Record<string, number> = {};
    filteredHistory.forEach(s => s.exercises.forEach(pe => {
       const ex = allExercises.find(e => e.id === pe.exerciseId);
       if(ex) {
          const muscle = ex.primaryMuscles?.[0] || ex.muscleGroups[0];
          muscleCounts[muscle] = (muscleCounts[muscle] || 0) + pe.sets.filter(s => s.completed).length;
       }
    }));
    const radarData = Object.entries(muscleCounts).map(([subject, A]) => ({ subject, A, fullMark: 100 })).sort((a,b) => b.A - a.A).slice(0, 6);

    return { totalVolume, count: filteredHistory.length, weeklyData, weightData, strengthData, radarData };
  }, [history, logs, timeRange, selectedExerciseId, activeTab, allExercises]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-[#1a1721] rounded-[32px] border border-white/5 overflow-hidden shadow-xl">
        
        {initialMode === 'recovery' && (
          <div className="p-2 flex gap-2 border-b border-white/5 overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => setActiveTab('recovery')}
              className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'recovery' ? 'bg-white/10 text-white shadow-lg' : 'text-text-dim hover:bg-white/5'
              }`}
            >
              <Zap size={14} className={activeTab === 'recovery' ? 'text-accent-green' : ''} />
              Återhämtning
            </button>
            
            <button 
              onClick={() => setActiveTab('injuries')}
              className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'injuries' ? 'bg-red-500/20 text-red-500 shadow-lg border border-red-500/20' : 'text-text-dim hover:bg-white/5'
              }`}
            >
              <ShieldAlert size={14} />
              Skador
            </button>
          </div>
        )}

        {(activeTab === 'recovery' || activeTab === 'injuries') && (
          <>
            <div className="text-center pt-4 px-4">
                <p className="text-xs text-text-dim">
                  {activeTab === 'recovery' 
                    ? 'Klicka på en muskel för att se vilka pass som bidragit till belastningen.' 
                    : 'Markera muskler som är skadade. Generatorn undviker dessa.'}
                </p>
            </div>
            <RecoveryMap 
                mode={activeTab} 
                recoveryScores={recoveryScores} 
                injuries={userProfile.injuries} 
                onToggle={toggleInjury}
                history={history}
                allExercises={allExercises}
            />
          </>
        )}

        {activeTab === 'analytics' && analyticsData && (
          <div className="p-4 space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
                  <BarChart2 size={20} className="text-accent-blue" /> Statistik
                </h3>
             </div>

             <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                {['1M', '3M', '6M', '1Y', 'ALL'].map(range => (
                   <button 
                     key={range} 
                     onClick={() => setTimeRange(range)} 
                     className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${timeRange === range ? 'bg-white text-black' : 'text-text-dim hover:text-white'}`}
                   >
                     {range}
                   </button>
                ))}
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 text-text-dim mb-1"><Calendar size={12}/><span className="text-[9px] uppercase font-bold">Pass</span></div>
                   <p className="text-2xl font-black text-white">{analyticsData.count}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 text-text-dim mb-1"><Dumbbell size={12}/><span className="text-[9px] uppercase font-bold">Volym (Ton)</span></div>
                   <p className="text-2xl font-black text-accent-blue">{Math.round(analyticsData.totalVolume / 1000)}</p>
                </div>
             </div>

             <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <h3 className="text-xs font-black italic uppercase text-white mb-4">Träningsfrekvens</h3>
                <div className="h-40 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.weeklyData}>
                         <XAxis dataKey="name" tick={{fontSize: 9}} stroke="#ffffff30" axisLine={false} tickLine={false} />
                         <Tooltip cursor={{fill: 'white', opacity: 0.1}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px', fontSize: '10px'}} />
                         <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <h3 className="text-xs font-black italic uppercase text-white mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-accent-pink"/> Viktkurva</h3>
                <div className="h-48 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.weightData}>
                         <defs><linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff2d55" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff2d55" stopOpacity={0}/></linearGradient></defs>
                         <CartesianGrid stroke="#ffffff05" vertical={false} />
                         <XAxis dataKey="date" hide />
                         <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '10px'}} />
                         <Area type="monotone" dataKey="weight" stroke="#ff2d55" strokeWidth={3} fill="url(#colorWeight)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <div className="mb-4">
                   <h3 className="text-xs font-black italic uppercase text-white mb-2">Styrkeutveckling (1RM)</h3>
                   <select 
                     value={selectedExerciseId} 
                     onChange={(e) => setSelectedExerciseId(e.target.value)} 
                     className="w-full bg-black/30 text-white text-xs font-bold p-2 rounded-lg outline-none border border-white/10"
                   >
                     {exercisesWithHistory.length > 0 ? (
                       exercisesWithHistory.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)
                     ) : (
                       <option value="">Ingen historik tillgänglig</option>
                     )}
                   </select>
                </div>
                <div className="h-48 w-full">
                   {analyticsData.strengthData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={analyticsData.strengthData}>
                            <CartesianGrid stroke="#ffffff05" vertical={false} />
                            <XAxis dataKey="date" stroke="#ffffff30" fontSize={9} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '10px'}} />
                            <Line type="stepAfter" dataKey="oneRM" stroke="#22c55e" strokeWidth={3} dot={{r: 3, fill: '#22c55e'}} />
                         </LineChart>
                      </ResponsiveContainer>
                   ) : <div className="h-full flex items-center justify-center text-text-dim text-[10px]">För lite data för denna övning</div>}
                </div>
             </div>

             <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <h3 className="text-xs font-black italic uppercase text-white mb-2 text-center">Fokusområden (Volym)</h3>
                <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={analyticsData.radarData}>
                         <PolarGrid stroke="#ffffff10" />
                         <PolarAngleAxis dataKey="subject" tick={{ fill: '#fff', fontSize: 9, fontWeight: 900 }} />
                         <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                         <Radar name="Volym" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.5} />
                      </RadarChart>
                   </ResponsiveContainer>
                </div>
             </div>

          </div>
        )}

      </div>
    </div>
  );
};
