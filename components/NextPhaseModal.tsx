
import React, { useState, useEffect } from 'react';
import { AIProgram, AIPlanResponse, ScheduledActivity, ProgressionRate, SetType, PlannedExercise, WorkoutSession, Exercise } from '../types';
import { storage } from '../services/storage';
import { generateNextPhase } from '../services/geminiService';
import { calculatePPLStats, analyzeProgressTrend, PROGRESSION_MATRIX, suggestWeightForReps } from '../utils/progression';
import { X, Calendar, Repeat, Clock, Loader2, Send, AlertTriangle, TrendingUp } from 'lucide-react';

interface NextPhaseModalProps {
  program: AIProgram;
  onClose: () => void;
  onGenerated: () => void;
  history: WorkoutSession[];
  allExercises: Exercise[];
  scheduled: ScheduledActivity[];
}

export const NextPhaseModal: React.FC<NextPhaseModalProps> = ({ program, onClose, onGenerated, history, allExercises, scheduled }) => {
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [weeks, setWeeks] = useState(4); // State for week duration
  const [progressionRate, setProgressionRate] = useState<ProgressionRate>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
        document.body.style.overflow = 'auto';
    };
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);

    const completedInPhase = scheduled.filter(s => s.programId === program.id && s.isCompleted).length;
    if (completedInPhase === 0) {
      setError("Du måste slutföra minst ett pass i den nuvarande fasen för att skapa en ny. Detta ger AI:n en baslinje för din nuvarande styrka.");
      setLoading(false);
      return;
    }

    try {
      const currentStats = calculatePPLStats(history, allExercises);
      const startStats = program.startStats || currentStats;
      const trend = analyzeProgressTrend(startStats, currentStats);
      const rules = PROGRESSION_MATRIX[progressionRate][trend];

      const result = await generateNextPhase(
        program, history, allExercises,
        { start: startStats, current: currentStats },
        { daysPerWeek, durationMinutes, weeks, progressionRate },
        rules
      );

      await storage.clearUpcomingProgramActivities(program.id);
      
      const lastProgramActivity = scheduled
        .filter(r => r.programId === program.id)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .pop();
        
      const lastDate = lastProgramActivity ? new Date(lastProgramActivity.date) : new Date();
      
      const dayOfWeek = lastDate.getDay();
      const daysUntilMonday = (dayOfWeek === 1) ? 7 : (8 - dayOfWeek) % 7;
      const startOfNewPhase = new Date(lastDate);
      startOfNewPhase.setDate(lastDate.getDate() + daysUntilMonday);
      startOfNewPhase.setHours(0,0,0,0);
      
      for (const r of result.routines) {
        const weekNum = r.weekNumber || 1;
        const dayNum = r.scheduledDay || 1;
        
        const sessionDate = new Date(startOfNewPhase);
        sessionDate.setDate(startOfNewPhase.getDate() + ((weekNum - 1) * 7) + (dayNum - 1));

        const exercisesWithWeights: PlannedExercise[] = r.exercises.map((ex) => {
            const repsString = ex.targetReps.toString();
            const parsedReps = parseInt(repsString.split('-')[0], 10) || 8;
            const historyWeight = suggestWeightForReps(ex.id, parsedReps, history);
            const finalWeight = historyWeight > 0 ? historyWeight : (ex.estimatedWeight || 20);
            return {
                exerciseId: ex.id,
                sets: Array(ex.targetSets).fill(null).map(() => ({ reps: parsedReps, weight: finalWeight, completed: false, type: 'normal' as SetType })),
                notes: `AI Est. vikt: ${ex.estimatedWeight || 0}kg`
            };
        });
        
        const activity: ScheduledActivity = {
            id: `sched-ai-${program.id}-p${(program.phaseNumber || 1) + 1}-w${weekNum}-d${dayNum}`,
            date: sessionDate.toISOString().split('T')[0],
            type: 'gym',
            title: r.name,
            isCompleted: false,
            exercises: exercisesWithWeights,
            programId: program.id,
            weekNumber: program.weeks + weekNum
        };
        await storage.addScheduledActivity(activity);
      }

      const updatedProgram: AIProgram = {
        ...program,
        status: 'active',
        motivation: result.motivation,
        weeks: program.weeks + weeks,
        phaseNumber: (program.phaseNumber || 1) + 1,
        startStats: currentStats,
      };
      await storage.saveAIProgram(updatedProgram);

      alert(`Nästa fas är genererad! ${result.routines.length} nya pass har lagts till i din kalender.`);
      onGenerated();
      onClose();

    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Kunde inte generera nästa fas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Nästa Fas</h3>
            <p className="text-[10px] text-text-dim font-black uppercase tracking-widest mt-1">Justera & Generera</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 scrollbar-hide flex-1 overscroll-contain">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-400 block">Längd på nästa fas</label>
              <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5">
                <button onClick={() => setWeeks(Math.max(1, weeks - 1))} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10">-</button>
                <span className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar size={18} className="text-blue-400"/>
                  {weeks} veckor
                </span>
                <button onClick={() => setWeeks(Math.min(12, weeks + 1))} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10">+</button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                    <label className="text-[10px] text-text-dim font-bold uppercase mb-2 flex items-center gap-1"><Calendar size={12}/> Frekvens</label>
                    <div className="flex items-center justify-between">
                        <button onClick={() => setDaysPerWeek(Math.max(1, daysPerWeek - 1))} className="text-white bg-white/10 w-8 h-8 rounded-lg font-bold">-</button>
                        <span className="text-white font-bold">{daysPerWeek} /v</span>
                        <button onClick={() => setDaysPerWeek(Math.min(7, daysPerWeek + 1))} className="text-white bg-white/10 w-8 h-8 rounded-lg font-bold">+</button>
                    </div>
                </div>
                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                    <label className="text-[10px] text-text-dim font-bold uppercase mb-2 flex items-center gap-1"><Clock size={12}/> Tid/pass</label>
                    <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full bg-transparent text-white font-bold outline-none text-sm"><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option></select>
                </div>
            </div>
            
            <div>
                <h3 className="text-sm font-black italic uppercase text-white mb-3">Välj Ökningstakt</h3>
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setProgressionRate('conservative')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${progressionRate === 'conservative' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-white/5 border-transparent text-text-dim'}`}><div className="text-2xl">🛡️</div><div className="text-[10px] font-black uppercase tracking-widest">Lugn</div></button>
                    <button onClick={() => setProgressionRate('normal')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${progressionRate === 'normal' ? 'bg-accent-blue/20 border-accent-blue text-accent-blue' : 'bg-white/5 border-transparent text-text-dim'}`}><div className="text-2xl">⚖️</div><div className="text-[10px] font-black uppercase tracking-widest">Normal</div></button>
                    <button onClick={() => setProgressionRate('aggressive')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${progressionRate === 'aggressive' ? 'bg-accent-pink/20 border-accent-pink text-accent-pink' : 'bg-white/5 border-transparent text-text-dim'}`}><div className="text-2xl">🔥</div><div className="text-[10px] font-black uppercase tracking-widest">Tuff</div></button>
                </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-1" />
                <p className="text-xs text-red-400 font-medium">{error}</p>
              </div>
            )}
        </div>
        
        <div className="p-6 border-t border-white/5 bg-black/20">
            <button 
                onClick={handleGenerate} 
                disabled={loading}
                className="w-full py-5 bg-white text-black rounded-3xl font-black italic text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
                {loading ? <Loader2 className="animate-spin" /> : <TrendingUp size={24} />}
                {loading ? 'Analyserar...' : 'Bygg Nästa Fas'}
            </button>
        </div>
      </div>
    </div>
  );
};
