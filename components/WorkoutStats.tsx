
import React, { useState, useMemo, useEffect } from 'react';
import { WorkoutSession, Exercise, MuscleGroup, UserProfile } from '../types';
import { calculateExerciseImpact } from '../utils/recovery';
import { X, Dumbbell, Activity, Plus, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface WorkoutStatsProps {
  session: WorkoutSession | null;
  allExercises: Exercise[];
  userProfile: UserProfile;
  onAddExercise: (exercise: Exercise) => void;
}

// Definitioner för att kunna gruppera och sortera
type MuscleCategory = 'main' | 'accessory';
interface MuscleDef { id: MuscleGroup; name: MuscleGroup; category: MuscleCategory; }

// Använder svenska namn som ID för att matcha resten av appen
const MUSCLE_DEFS: MuscleDef[] = [
  { id: 'Bröst', name: 'Bröst', category: 'main' },
  { id: 'Rygg', name: 'Rygg', category: 'main' },
  { id: 'Axlar', name: 'Axlar', category: 'main' },
  { id: 'Framsida lår', name: 'Framsida lår', category: 'main' },
  { id: 'Baksida lår', name: 'Baksida lår', category: 'main' },
  { id: 'Säte', name: 'Säte', category: 'main' },
  { id: 'Mage', name: 'Mage', category: 'main' },
  { id: 'Ryggslut', name: 'Ryggslut', category: 'main' },
  { id: 'Triceps', name: 'Triceps', category: 'main' },
  { id: 'Biceps', name: 'Biceps', category: 'main' },
  { id: 'Vader', name: 'Vader', category: 'accessory' },
  { id: 'Trapezius', name: 'Trapezius', category: 'accessory' },
  { id: 'Underarmar', name: 'Underarmar', category: 'accessory' },
  { id: 'Adduktorer', name: 'Adduktorer', category: 'accessory' },
  { id: 'Abduktorer', name: 'Abduktorer', category: 'accessory' },
  { id: 'Nacke', name: 'Nacke', category: 'accessory' },
];

const RecoveryMapBody = ({p}: {p: (m: MuscleGroup) => any}) => (
    <div className="flex justify-center gap-4 py-4 select-none overflow-x-auto scrollbar-hide">
      <svg viewBox="0 0 200 500" className="h-64 w-auto drop-shadow-xl shrink-0">
        <text x="100" y="20" textAnchor="middle" fill="white" fontSize="10" opacity="0.3" fontWeight="900">FRONT</text>
        <rect x="90" y="35" width="20" height="15" rx="5" {...p('Nacke')} />
        <path d="M70,55 L90,40 L110,40 L130,55" {...p('Trapezius')} />
        <circle cx="55" cy="75" r="18" {...p('Axlar')} />
        <circle cx="145" cy="75" r="18" {...p('Axlar')} />
        <path d="M73,75 Q100,95 127,75 L120,130 Q100,140 80,130 Z" {...p('Bröst')} />
        <ellipse cx="40" cy="115" rx="12" ry="22" {...p('Biceps')} />
        <ellipse cx="160" cy="115" rx="12" ry="22" {...p('Biceps')} />
        <path d="M35,145 L55,145 L50,190 L40,190 Z" {...p('Underarmar')} />
        <path d="M165,145 L145,145 L150,190 L160,190 Z" {...p('Underarmar')} />
        <rect x="80" y="135" width="40" height="75" rx="5" {...p('Mage')} />
        <path d="M75,220 L95,220 L95,330 L65,330 Z" {...p('Framsida lår')} />
        <path d="M125,220 L105,220 L105,330 L135,330 Z" {...p('Framsida lår')} />
        <path d="M95,230 L95,300 L100,230 Z" {...p('Adduktorer')} />
        <path d="M105,230 L105,300 L100,230 Z" {...p('Adduktorer')} />
        <path d="M65,220 L60,280 L75,230 Z" {...p('Abduktorer')} />
        <path d="M135,220 L140,280 L125,230 Z" {...p('Abduktorer')} />
        <path d="M70,340 L90,340 L85,420 L75,420 Z" {...p('Vader')} />
        <path d="M130,340 L110,340 L115,420 L125,420 Z" {...p('Vader')} />
      </svg>
      <svg viewBox="0 0 200 500" className="h-64 w-auto drop-shadow-xl shrink-0">
        <text x="100" y="20" textAnchor="middle" fill="white" fontSize="10" opacity="0.3" fontWeight="900">BACK</text>
        <rect x="90" y="35" width="20" height="15" rx="5" {...p('Nacke')} />
        <path d="M70,55 L130,55 L100,140 Z" {...p('Trapezius')} />
        <circle cx="50" cy="75" r="15" {...p('Axlar')} />
        <circle cx="150" cy="75" r="15" {...p('Axlar')} />
        <path d="M65,80 L55,160 L100,190 L145,160 L135,80 L100,140 Z" {...p('Rygg')} />
        <rect x="85" y="190" width="30" height="25" {...p('Ryggslut')} />
        <ellipse cx="40" cy="115" rx="11" ry="20" {...p('Triceps')} />
        <ellipse cx="160" cy="115" rx="11" ry="20" {...p('Triceps')} />
        <path d="M30,145 L50,145 L45,190 L35,190 Z" {...p('Underarmar')} />
        <path d="M170,145 L150,145 L155,190 L165,190 Z" {...p('Underarmar')} />
        <path d="M60,220 Q100,210 140,220 Q140,260 100,260 Q60,260 60,220" {...p('Säte')} />
        <path d="M70,265 L95,265 L90,340 L75,340 Z" {...p('Baksida lår')} />
        <path d="M130,265 L105,265 L110,340 L125,340 Z" {...p('Baksida lår')} />
        <ellipse cx="82" cy="380" rx="13" ry="35" {...p('Vader')} />
        <ellipse cx="118" cy="380" rx="13" ry="35" {...p('Vader')} />
      </svg>
    </div>
);

export const WorkoutStats: React.FC<WorkoutStatsProps> = ({ session, allExercises, userProfile, onAddExercise }) => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // SCALING FACTOR: Förvandlar råa poäng (t.ex. 20 000) till en "Strain Score" (0-100)
  const POINTS_DIVISOR = 300;

  const stats = useMemo(() => {
    if (!session) return { totalLoad: 0, totalSets: 0, totalReps: 0, strainScore: 0 };

    let totalLoad = 0;
    let totalSets = 0;
    let totalReps = 0;

    session.exercises.forEach(plannedEx => {
      const exData = allExercises.find(e => e.id === plannedEx.exerciseId);
      const completedSets = plannedEx.sets.filter(s => s.completed);

      if (exData && completedSets.length > 0) {
        totalLoad += calculateExerciseImpact(exData, completedSets, userProfile.weight);
      }
      
      completedSets.forEach(set => {
        totalSets++;
        totalReps += set.reps || 0;
      });
    });

    const strainScore = Math.round(totalLoad / POINTS_DIVISOR);

    return { totalLoad, totalSets, totalReps, strainScore };
  }, [session, allExercises, userProfile]);

  // Lås scroll på bakgrunden när modalen är öppen
  useEffect(() => {
    if (selectedMuscle) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedMuscle]);

  // --- AVANCERAD BELASTNINGSBERÄKNING ---
  const muscleStats = useMemo(() => {
    if (!session) return { muscleLoad: {}, totalLoadScore: 0 };
    
    const muscleLoad: Record<string, { 
      score: number;
      rawSets: number; 
      exercises: { name: string; sets: number; weight: number; reps: number; role: string }[] 
    }> = {};
    
    let totalLoadScore = 0;

    session.exercises.forEach(sessionEx => {
      const def = allExercises.find(e => e.id === sessionEx.exerciseId);
      if (!def || sessionEx.sets.length === 0) return;
      
      const exerciseLoad = calculateExerciseImpact(def, sessionEx.sets, userProfile.weight);
      
      const addStats = (mId: MuscleGroup, role: 'Primär' | 'Sekundär') => {
        if (!muscleLoad[mId]) muscleLoad[mId] = { score: 0, rawSets: 0, exercises: [] };
        
        const roleFactor = role === 'Primär' ? 1.0 : 0.5;
        const score = exerciseLoad * roleFactor;

        muscleLoad[mId].score += score;
        muscleLoad[mId].rawSets += sessionEx.sets.length;
        totalLoadScore += score;
        
        const maxWeight = Math.max(...sessionEx.sets.map(s => s.weight || 0));
        const totalReps = sessionEx.sets.reduce((acc, s) => acc + (s.reps || 0), 0);

        muscleLoad[mId].exercises.push({ 
          name: def.name, 
          sets: sessionEx.sets.length, 
          weight: maxWeight,
          reps: totalReps,
          role 
        });
      };

      const primaries = (def.primaryMuscles && def.primaryMuscles.length > 0) ? def.primaryMuscles : def.muscleGroups;
      primaries?.forEach(m => addStats(m, 'Primär'));
      def.secondaryMuscles?.forEach(m => addStats(m, 'Sekundär'));
    });

    return { muscleLoad, totalLoadScore };
  }, [session, allExercises, userProfile]);

  const maxScoreInSession = useMemo(() => Math.max(...Object.values(muscleStats.muscleLoad).map((m: { score: number }) => m.score), 1), [muscleStats]);

  // Färglogik baserat på Score
  const getMuscleColor = (muscleId: MuscleGroup) => {
    const data = muscleStats.muscleLoad[muscleId];
    if (!data || data.score === 0) return '#ffffff10'; 
    
    const percentageOfMax = (data.score / maxScoreInSession) * 100;
    
    if (percentageOfMax < 33) return '#3b82f660'; 
    if (percentageOfMax < 66) return '#3b82f6';
    return '#2563eb';
  };

  const getStrainColor = (score: number) => {
    if (score < 20) return 'text-accent-green'; // Lätt
    if (score < 45) return 'text-accent-blue';  // Medel
    if (score < 70) return 'text-yellow-500';   // Hårt
    return 'text-accent-pink';                  // Extremt
  };
  
  const p = (muscle: MuscleGroup) => ({
    fill: getMuscleColor(muscle),
    onClick: () => setSelectedMuscle(muscle),
    className: 'cursor-pointer hover:opacity-80 active:scale-95 transition-all',
    stroke: 'rgba(255,255,255,0.1)',
    strokeWidth: "0.5"
  });

  const recommendedExercises = useMemo(() => {
    if (!selectedMuscle || !session) return [];
    return allExercises
        .filter(ex => 
            ex.primaryMuscles?.includes(selectedMuscle) && 
            !session.exercises.some(sessEx => sessEx.exerciseId === ex.id)
        )
        .sort((a: Exercise, b: Exercise) => (b.score || 5) - (a.score || 5))
        .slice(0, 5);
  }, [selectedMuscle, allExercises, session]);

  const renderMuscleGroup = (category: MuscleCategory) => {
    const group = MUSCLE_DEFS.filter(m => m.category === category);
    const activeMuscles = group
        .filter(m => muscleStats.muscleLoad[m.id])
        .sort((a,b) => (muscleStats.muscleLoad[b.id]?.score || 0) - (muscleStats.muscleLoad[a.id]?.score || 0));

    if (activeMuscles.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className="text-xs font-black text-text-dim uppercase tracking-widest mb-3 border-b border-white/5 pb-1">
            {category === 'main' ? 'Huvudmuskler' : 'Sekundära'}
        </h4>
        <div className="space-y-2">
            {activeMuscles.map(m => {
                const data = muscleStats.muscleLoad[m.id];
                const percentage = muscleStats.totalLoadScore > 0 
                    ? Math.round((data.score / muscleStats.totalLoadScore) * 100) 
                    : 0;
                
                return (
                    <button 
                        key={m.id}
                        onClick={() => setSelectedMuscle(m.id)}
                        className="w-full bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between group active:scale-95 transition-all"
                    >
                        <span className="text-sm font-bold text-white">{m.name}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-text-dim">{data.rawSets} set</span>
                            <div className="flex items-center gap-2 min-w-[60px] justify-end">
                                <span className="text-xs font-mono text-accent-blue">{percentage}%</span>
                                <div className="w-10 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-blue rounded-full" style={{ width: `${percentage}%` }} />
                                </div>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-[#1a1721] rounded-2xl border border-white/5 p-4 flex justify-around items-center">
        <div className="flex-1 text-center">
          <p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
            <Zap size={10} /> Belastning
          </p>
          <div className="flex flex-col items-center">
            <div className="flex items-baseline justify-center gap-2">
                <span className={`text-4xl font-black italic tracking-tighter ${getStrainColor(stats.strainScore)}`}>{stats.strainScore}</span>
                <span className="text-sm font-bold uppercase text-white/40">Strain</span>
            </div>
            <div className="w-24 h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getStrainColor(stats.strainScore).replace('text-', 'bg-')}`} 
                    style={{ width: `${Math.min(100, stats.strainScore)}%` }} 
                />
            </div>
          </div>
        </div>
        <div className="w-px h-12 bg-white/5" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">Totala Set</p>
          <span className="text-4xl font-black italic text-white tracking-tighter">{stats.totalSets}</span>
        </div>
        <div className="w-px h-12 bg-white/5" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">Totala Reps</p>
          <span className="text-4xl font-black italic text-white tracking-tighter">{stats.totalReps}</span>
        </div>
      </div>

      <div className="bg-[#1a1721] rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
          <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full p-4 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
          >
              <div className="flex items-center gap-2">
                  <Activity size={16} className="text-accent-blue" />
                  <span className="text-sm font-black text-white uppercase tracking-widest">Muskelfördelning</span>
              </div>
              {isExpanded ? <ChevronUp size={20} className="text-text-dim" /> : <ChevronDown size={20} className="text-text-dim" />}
          </button>

          {isExpanded && (
              <div className="p-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="relative w-full flex justify-center mb-6 border-b border-white/5 pb-4">
                      <RecoveryMapBody p={p} />
                      <div className="absolute top-0 right-0 flex flex-col gap-1 text-[9px] font-bold uppercase text-text-dim">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#2563eb]"/>Hög Belastning</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3b82f6]"/>Medel Belastning</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3b82f660]"/>Låg Belastning</div>
                      </div>
                  </div>

                  {renderMuscleGroup('main')}
                  {renderMuscleGroup('accessory')}
                  
                  {muscleStats.totalLoadScore === 0 && (
                      <p className="text-center text-xs text-text-dim italic py-2">
                          Logga set med vikt och reps för att se fördelning.
                      </p>
                  )}
              </div>
          )}

          {selectedMuscle && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 p-4 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setSelectedMuscle(null); }}>
                <div className="bg-[#1a1721] w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1a1721] rounded-t-3xl shrink-0">
                        <div>
                            <p className="text-[10px] text-text-dim uppercase tracking-widest">Analys</p>
                            <h3 className="text-xl font-black italic text-white uppercase">{MUSCLE_DEFS.find(m => m.id === selectedMuscle)?.name}</h3>
                        </div>
                        <button onClick={() => setSelectedMuscle(null)} className="p-2 bg-white/5 rounded-full"><X className="text-white" size={20} /></button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-8 overscroll-contain">
                        <div>
                            <h4 className="text-xs font-black text-text-dim uppercase mb-3 flex items-center gap-2"><Activity size={14} /> Bidragande Övningar</h4>
                            <div className="space-y-2">
                                {muscleStats.muscleLoad[selectedMuscle]?.exercises.length > 0 ? (
                                    muscleStats.muscleLoad[selectedMuscle]?.exercises.map((ex, idx) => (
                                        <div key={idx} className="bg-white/5 p-3 rounded-xl flex justify-between items-center">
                                            <div>
                                                <span className="text-sm font-bold text-white block">{ex.name}</span>
                                                <span className="text-[10px] text-text-dim">{ex.weight}kg x {ex.reps} totala reps</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-white">{ex.sets} set</p>
                                                <p className="text-[10px] text-text-dim">{ex.role}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : <p className="text-xs text-text-dim italic">Inga set loggade för denna muskel än.</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-text-dim uppercase mb-3 flex items-center gap-2"><Dumbbell size={14} className="text-accent-blue" /> Rekommenderade Övningar</h4>
                            <div className="space-y-2">
                                {recommendedExercises.length > 0 ? (
                                    recommendedExercises.map(ex => (
                                        <div key={ex.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-accent-blue/50 transition-colors">
                                            <span className="text-sm font-bold text-white">{ex.name}</span>
                                            {onAddExercise && (
                                                <button 
                                                    onClick={() => { onAddExercise(ex); setSelectedMuscle(null); }}
                                                    className="flex items-center gap-1 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                ><Plus size={14} /> Lägg till</button>
                                            )}
                                        </div>
                                    ))
                                ) : <p className="text-xs text-text-dim italic">Inga fler övningar hittades.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
      </div>
    </>
  );
};
