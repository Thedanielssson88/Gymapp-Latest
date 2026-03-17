
import React, { useState, useEffect } from 'react';
import { Sparkles, Send, Loader2, Save, Calendar, Repeat, Clock, Dumbbell } from 'lucide-react';
import { generateProfessionalPlan } from '../services/geminiService';
import { storage } from '../services/storage';
import { UserMission, ScheduledActivity, PlannedExercise, SetType, Exercise, AIProgram, AIPlanResponse, ProgressionRate, UserProfile } from '../types';
import { calculatePPLStats, suggestWeightForReps } from '../utils/progression';
import { calculate1RM, getLastPerformance } from '../utils/fitness';
import { ColorPicker } from './ColorPicker';

interface AIArchitectProps {
  onClose: () => void;
}

export const AIArchitect: React.FC<AIArchitectProps> = ({ onClose }) => {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIPlanResponse | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  // Settings
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [weeksToSchedule, setWeeksToSchedule] = useState(4); // Default 4 veckor
  const [progressionRate, setProgressionRate] = useState<ProgressionRate>('normal');
  const [programColor, setProgramColor] = useState('#1a1721'); // Färg för alla pass i programmet

  useEffect(() => {
      storage.getAllExercises().then(setAllExercises);
  }, []);

  const handleGenerate = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setPlan(null);
    try {
      const fullHistory = await storage.getHistory();
      const exercises = await storage.getAllExercises();
      const profile = await storage.getUserProfile();

      // AI PROGRAM - Optimering: Senaste 12 veckor eller max 30 pass
      const weeksToInclude = 12;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (weeksToInclude * 7));

      const recentHistory = fullHistory
        .filter(h => new Date(h.date) >= cutoffDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30); // Max 30 pass även om det är inom 12 veckor

      const pplStats = calculatePPLStats(recentHistory, exercises);

      const result = await generateProfessionalPlan(
        request, recentHistory, exercises, profile, pplStats,
        { daysPerWeek, durationMinutes, durationWeeks: weeksToSchedule, progressionRate }
      );
      setPlan(result);
    } catch (error) {
      console.error("AI Error:", error);
      alert((error as Error).message || "Kunde inte skapa planen. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async () => {
    if (!plan) return;
    setLoading(true);

    try {
      const fullHistory = await storage.getHistory();
      
      const startObj = new Date(startDate);
      startObj.setHours(0, 0, 0, 0);

      const programId = `ai-prog-${Date.now()}`;
      const newProgram: AIProgram = {
        id: programId,
        name: `AI: ${request.substring(0, 20)}...`,
        createdAt: new Date().toISOString(),
        status: 'active',
        motivation: plan.motivation,
        goalIds: [],
        weeks: weeksToSchedule,
        phaseNumber: 1, // Startar alltid på Fas 1
        longTermGoalDescription: request, // Spara det ursprungliga målet
        color: programColor, // Färgen för alla pass i programmet
      };
      
      const newMissions: UserMission[] = [];
      if (plan.smartGoals) {
        for (const g of plan.smartGoals) {
            const newMission: UserMission = {
                id: `mission-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                type: 'smart_goal',
                title: g.title,
                isCompleted: false, progress: 0, total: g.targetValue,
                createdAt: new Date().toISOString(),
                exerciseId: g.exerciseId,
                smartConfig: { ...g, startValue: g.startValue || 0 } // Använd AI:s startvärde
            };
            newMissions.push(newMission);
            newProgram.goalIds.push(newMission.id);
        }
      }

      for (const r of plan.routines) {
        const weekNum = r.weekNumber || 1;
        const dayNum = r.scheduledDay || 1;
        
        const sessionDate = new Date(startObj);
        // Calculate date: Start Date + ((Week - 1) * 7) + (Day - 1)
        sessionDate.setDate(startObj.getDate() + ((weekNum - 1) * 7) + (dayNum - 1));

        const exercisesWithWeights: PlannedExercise[] = r.exercises.map((ex) => {
            const repsString = ex.targetReps.toString();
            const parsedReps = parseInt(repsString.split('-')[0], 10) || 8;
            const historyWeight = suggestWeightForReps(ex.id, parsedReps, fullHistory);
            const finalWeight = historyWeight > 0 ? historyWeight : (ex.estimatedWeight || 20);
            return {
                exerciseId: ex.id,
                sets: Array(ex.targetSets).fill(null).map(() => ({ reps: parsedReps, weight: finalWeight, completed: false, type: 'normal' as SetType })),
                notes: `AI Est. vikt: ${ex.estimatedWeight || 0}kg`
            };
        });
        
        const activity: ScheduledActivity = {
            id: `sched-ai-${programId}-w${weekNum}-d${dayNum}`,
            date: sessionDate.toISOString().split('T')[0],
            type: 'gym',
            title: r.name,
            isCompleted: false,
            exercises: exercisesWithWeights,
            programId: programId,
            weekNumber: weekNum,
            color: programColor // Ärv färgen från programmet
        };
        await storage.addScheduledActivity(activity);
      }

      await storage.saveAIProgram(newProgram);
      for (const mission of newMissions) { await storage.addUserMission(mission); }
      
      alert(`Program sparat! ${plan.routines.length} pass har lagts till i din kalender över ${weeksToSchedule} veckor med start ${startDate}.`);
      setPlan(null);
      setRequest('');
      onClose();
    } catch (error) {
      console.error("Failed to apply AI plan:", error);
      alert("Kunde inte spara planen. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-32">
      <div className="bg-gradient-to-br from-[#1a1721] to-[#2a2435] p-6 rounded-3xl border border-accent-blue/20 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent-blue/10 rounded-full"><Sparkles className="text-accent-blue" size={24} /></div>
          <h2 className="text-xl font-black uppercase italic text-white">Nytt Träningsprogram</h2>
        </div>
        
        <div className="space-y-3 mb-4">
            {/* Start Date Selection */}
            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <label className="text-[10px] text-text-dim font-bold uppercase mb-2 flex items-center gap-1">
                    <Calendar size={12}/> Startdatum
                </label>
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="w-full bg-transparent text-white font-bold outline-none text-sm placeholder-text-dim"
                />
            </div>

            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <label className="text-[10px] text-text-dim font-bold uppercase mb-2 flex items-center gap-1"><Repeat size={12}/> Programlängd</label>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(w => (
                        <button key={w} onClick={() => setWeeksToSchedule(w)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${ weeksToSchedule === w ? 'bg-accent-blue text-black' : 'bg-white/5 text-text-dim hover:bg-white/10'}`}>{w} Veckor</button>
                    ))}
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
        </div>

        <div className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 delay-150">
          <h3 className="text-sm font-black italic uppercase text-white">Välj Ökningstakt</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setProgressionRate('conservative')}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                progressionRate === 'conservative'
                  ? 'bg-green-500/20 border-green-500 text-green-500'
                  : 'bg-white/5 border-transparent text-text-dim grayscale'
              }`}
            >
              <div className="text-2xl">🛡️</div>
              <div className="text-[10px] font-black uppercase tracking-widest">Lugn</div>
            </button>
            <button
              onClick={() => setProgressionRate('normal')}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                progressionRate === 'normal'
                  ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                  : 'bg-white/5 border-transparent text-text-dim grayscale'
              }`}
            >
              <div className="text-2xl">⚖️</div>
              <div className="text-[10px] font-black uppercase tracking-widest">Normal</div>
            </button>
            <button
              onClick={() => setProgressionRate('aggressive')}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                progressionRate === 'aggressive'
                  ? 'bg-accent-pink/20 border-accent-pink text-accent-pink'
                  : 'bg-white/5 border-transparent text-text-dim grayscale'
              }`}
            >
              <div className="text-2xl">🔥</div>
              <div className="text-[10px] font-black uppercase tracking-widest">Tuff</div>
            </button>
          </div>
          <p className="text-xs text-text-dim text-center mt-2 px-4 h-8">
            {progressionRate === 'conservative' && "Långsam ökning. Fokus på teknik, rehab eller underhåll."}
            {progressionRate === 'normal' && "Klassisk progression. Ca +2.5kg per vecka på stora lyft."}
            {progressionRate === 'aggressive' && "Maximal ökning. Krävande pass för att nå resultat snabbt."}
          </p>
        </div>

        {/* Color Picker */}
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 delay-200">
          <h3 className="text-sm font-black italic uppercase text-white mb-3">Välj Färg på Programmet</h3>
          <ColorPicker selectedColor={programColor} onSelectColor={setProgramColor} />
        </div>

        <textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Beskriv ditt mål... (T.ex. 'Jag vill öka 10kg i bänkpress')" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-base min-h-[100px] focus:border-accent-blue outline-none transition-all placeholder:text-white/20 resize-none mb-4 mt-6"/>

        <button onClick={handleGenerate} disabled={loading || !request} className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-sm shadow-lg"><Send size={18} /> {loading ? 'BYGGER PROGRAM...' : 'GENERERA PROGRAM'}</button>
      </div>

      {plan && (
        <div className="animate-in slide-in-from-bottom duration-500 space-y-4">
          <div className="bg-[#1a1721] p-6 rounded-3xl border border-white/10">
            <h3 className="text-accent-blue font-bold mb-2 uppercase tracking-widest text-xs flex items-center gap-2"><Sparkles size={12} /> Förslag ({plan.routines.length} pass)</h3>
            <p className="text-sm text-white mb-6 leading-relaxed italic">"{plan.motivation}"</p>
            
            <div className="space-y-2 mb-6 opacity-75">
              {plan.routines.slice(0, 3).map((r, i) => (
                <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/5 text-xs text-text-dim">
                    <span className="text-white font-bold block">{r.name}</span>
                    {r.exercises.length} övningar • Vecka {r.weekNumber}
                </div>
              ))}
              {plan.routines.length > 3 && (<p className="text-center text-[10px] text-text-dim">...och {plan.routines.length - 3} pass till</p>)}
            </div>

            <button onClick={applyPlan} className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg"><Save size={18} /> SPARA PROGRAM</button>
          </div>
        </div>
      )}
    </div>
  );
};
