
import React, { useState, useMemo, useEffect } from 'react';
import { MuscleGroup, WorkoutSession, Exercise, WorkoutSet } from '../types';
import { getMuscleWorkloadDetails, WorkloadDetail } from '../utils/recovery';
import { X, Activity, Dumbbell, Calendar, Info, AlertTriangle } from 'lucide-react';
import { registerBackHandler } from '../utils/backHandler';

// --- DEFINITIONS ---
const MAIN_MUSCLES: MuscleGroup[] = ['Bröst', 'Rygg', 'Axlar', 'Framsida lår', 'Baksida lår', 'Säte', 'Mage', 'Ryggslut', 'Triceps', 'Biceps'];
const ACCESSORY_MUSCLES: MuscleGroup[] = ['Vader', 'Trapezius', 'Underarmar', 'Adduktorer', 'Abduktorer', 'Nacke'];

// --- PROPS ---
interface RecoveryMapProps {
  mode: 'recovery' | 'injuries' | 'load';
  recoveryScores?: Record<string, number>;
  loadScores?: Record<string, number>;
  injuries?: MuscleGroup[];
  onToggle?: (muscle: MuscleGroup) => void;
  history: WorkoutSession[];
  allExercises: Exercise[];
}

const formatSeconds = (totalSeconds: number | undefined) => {
    if (totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- DETAIL MODAL COMPONENT ---
const RecoveryDetailModal: React.FC<{
  muscle: MuscleGroup;
  fatigue: number;
  onClose: () => void;
  contributors: WorkloadDetail[];
  getColor: (fatigue: number) => string;
}> = ({ muscle, fatigue, onClose, contributors, getColor }) => {

  useEffect(() => {
    return registerBackHandler(onClose);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1721] w-full sm:max-w-md max-h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl border border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1a1721] rounded-t-3xl shrink-0">
          <div>
            <p className="text-[10px] text-text-dim uppercase tracking-widest">Analys</p>
            <h3 className="text-2xl font-black italic text-white uppercase">{muscle}</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="text-white" /></button>
        </header>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 pb-24">
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl">
            <Activity className="text-text-dim" />
            <div>
              <p className="text-xs text-text-dim uppercase font-bold">Belastning (4 dygn)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{100 - Math.round(fatigue)}%</span>
                <span className="text-sm font-bold" style={{ color: getColor(100 - fatigue) }}>
                  {fatigue > 50 ? 'Hög' : fatigue > 20 ? 'Måttlig' : 'Låg'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
              <Calendar size={14} className="text-accent-blue"/> Senaste Passen
            </h4>
            <div className="space-y-3">
              {contributors.length > 0 ? (
                contributors.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-bottom-2" style={{animationDelay: `${idx * 50}ms`}}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-white font-bold text-sm">{item.exerciseName}</p>
                        <p className="text-[10px] text-text-dim uppercase">{new Date(item.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-accent-blue">+{Math.round(item.impactScore)}p</span>
                        <p className="text-[9px] text-text-dim">{item.role}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                        {item.sets.map((set, setIdx) => {
                            const historicalType = item.trackingType || 'reps_weight';
                            return (
                                <div key={setIdx} className="flex justify-between items-center text-xs text-text-dim bg-black/20 px-3 py-1.5 rounded-md">
                                    <span className="font-bold">Set {setIdx + 1}</span>
                                    <span className="text-white font-mono font-black">
                                        {historicalType === 'time_only' ? (
                                            `${formatSeconds(set.duration)}`
                                        ) : historicalType === 'time_distance' ? (
                                            `${set.distance}m @ ${formatSeconds(set.duration)}`
                                        ) : historicalType === 'reps_only' ? (
                                            `${set.reps} reps`
                                        ) : historicalType === 'reps_time_weight' ? (
                                            `${set.reps} reps (${formatSeconds(set.duration)})`
                                        ) : (
                                            `${set.reps} x ${set.weight}kg`
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
                  <Info className="mx-auto text-text-dim mb-2" />
                  <p className="text-text-dim text-xs">Ingen belastning registrerad de senaste 96 timmarna.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
export const RecoveryMap: React.FC<RecoveryMapProps> = ({ 
  mode, recoveryScores = {}, loadScores = {}, injuries = [], onToggle, history, allExercises
}) => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);

  const maxLoad = useMemo(() => {
    if (mode !== 'load' || !loadScores) return 1;
    const values = Object.values(loadScores);
    if (values.length === 0) return 1;
    return Math.max(...(values as number[]), 1);
  }, [mode, loadScores]);
  
  const getColor = (muscle: MuscleGroup) => {
    const isInjured = injuries.includes(muscle);
    if (isInjured) return '#ef4444';
    if (mode === 'injuries') return 'rgba(255, 255, 255, 0.1)';
    if (mode === 'load') {
      const load = loadScores[muscle] ?? 0;
      const percentage = (load / maxLoad) * 100;
      if (percentage > 75) return '#ff2d55';
      if (percentage > 40) return '#3b82f6';
      if (percentage > 0) return 'rgba(59, 130, 246, 0.4)';
      return 'rgba(255, 255, 255, 0.1)';
    }
    const score = recoveryScores[muscle] ?? 100;
    if (score >= 90) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#f97316';
  };
  
  const handleClick = (muscle: MuscleGroup) => {
    if (mode === 'injuries' && onToggle) onToggle(muscle);
    else if (mode === 'recovery') setSelectedMuscle(muscle);
  };

  const p = (muscle: MuscleGroup) => ({
    fill: getColor(muscle),
    onClick: () => handleClick(muscle),
    className: `transition-all duration-300 ${mode === 'injuries' || mode === 'recovery' ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}`,
    stroke: 'rgba(255,255,255,0.1)',
    strokeWidth: "0.5"
  });

  const contributors = useMemo(() => 
    selectedMuscle ? getMuscleWorkloadDetails(selectedMuscle, history, allExercises) : [],
    [selectedMuscle, history, allExercises]
  );
  
  const mainMusclesAlpha = [...MAIN_MUSCLES].sort((a,b) => a.localeCompare(b));
  const accessoryMusclesAlpha = [...ACCESSORY_MUSCLES].sort((a,b) => a.localeCompare(b));

  const mainMusclesByScore = [...MAIN_MUSCLES].sort((a,b) => (recoveryScores[a] ?? 100) - (recoveryScores[b] ?? 100));
  const accessoryMusclesByScore = [...ACCESSORY_MUSCLES].sort((a,b) => (recoveryScores[a] ?? 100) - (recoveryScores[b] ?? 100));

  const sortedMainMuscles = mode === 'recovery' ? mainMusclesByScore : mainMusclesAlpha;
  const sortedAccessoryMuscles = mode === 'recovery' ? accessoryMusclesByScore : accessoryMusclesAlpha;

  return (
    <div className="space-y-8">
      <RecoveryMapBody p={p} />
      <div className="space-y-6 px-2">
        <div>
          <h3 className="text-sm font-black text-text-dim uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Huvudmuskler</h3>
          <div className="grid grid-cols-2 gap-2">
            {sortedMainMuscles.map(m => {
              const isInjured = injuries.includes(m);
              if (mode === 'injuries') {
                return (
                  <button key={m} onClick={() => handleClick(m)} className={`p-3 rounded-xl flex items-center justify-between text-left transition-all border ${isInjured ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/5'}`}>
                    <span className={`font-bold uppercase text-sm ${isInjured ? 'text-red-400' : 'text-white'}`}>{m}</span>
                    {isInjured && <AlertTriangle size={16} className="text-red-500"/>}
                  </button>
                );
              }
              const score = recoveryScores[m] ?? 100;
              return (
                <button key={m} onClick={() => handleClick(m)} className="bg-[#1a1721] p-3 rounded-xl border border-white/5 flex items-center justify-between group active:scale-95 transition-all">
                  <span className="text-sm font-bold text-white">{m}</span>
                  <div className="flex items-center gap-2"><span className="text-xs font-mono text-text-dim">{Math.round(score)}%</span><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(m) }} /></div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-black text-text-dim uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Sekundära</h3>
          <div className="grid grid-cols-2 gap-2">
            {sortedAccessoryMuscles.map(m => {
              const isInjured = injuries.includes(m);
              if (mode === 'injuries') {
                 return (
                    <button key={m} onClick={() => handleClick(m)} className={`p-3 rounded-xl flex items-center justify-between text-left transition-all border ${isInjured ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/5'}`}>
                        <span className={`font-bold uppercase text-xs ${isInjured ? 'text-red-400' : 'text-text-dim'}`}>{m}</span>
                        {isInjured && <AlertTriangle size={16} className="text-red-500"/>}
                    </button>
                 );
              }
              const score = recoveryScores[m] ?? 100;
              return (
                <button key={m} onClick={() => handleClick(m)} className="bg-[#1a1721] p-3 rounded-xl border border-white/5 flex items-center justify-between group active:scale-95 transition-all">
                  <span className="text-xs font-bold text-text-dim group-hover:text-white transition-colors">{m}</span>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-text-dim">{Math.round(score)}%</span><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getColor(m) }} /></div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selectedMuscle && mode === 'recovery' && (
        <RecoveryDetailModal 
          muscle={selectedMuscle}
          fatigue={100 - (recoveryScores[selectedMuscle] ?? 100)}
          onClose={() => setSelectedMuscle(null)}
          contributors={contributors}
          getColor={_ => getColor(selectedMuscle)}
        />
      )}
    </div>
  );
};

const RecoveryMapBody = ({p}: {p: (m: MuscleGroup) => any}) => (
    <div className="flex justify-center gap-4 py-4 select-none overflow-x-auto scrollbar-hide">
      <svg viewBox="0 0 200 500" className="h-80 w-auto drop-shadow-xl shrink-0">
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
      <svg viewBox="0 0 200 500" className="h-80 w-auto drop-shadow-xl shrink-0">
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
