import React, { useState, useEffect, useMemo } from 'react';
import { Exercise, WorkoutSession, WorkoutSet } from '../types';
import { useExerciseImage } from '../hooks/useExerciseImage';
import { registerBackHandler } from '../utils/backHandler';
import { X, Dumbbell, Info, Calendar, Trophy, History, Shuffle, MessageSquare, RefreshCw, Activity, Camera } from 'lucide-react';
import { calculate1RM } from '../utils/fitness';

interface ExerciseInfoModalProps {
  exercise: Exercise;
  onClose: () => void;
  history: WorkoutSession[];
  allExercises: Exercise[];
  exIdx?: number;
  onApplyHistory?: (idx: number, sets: WorkoutSet[]) => void;
  onExerciseSwap?: (idx: number, newId: string) => void;
  onGoToExercise?: (exerciseId: string) => void;
  onEditImage?: () => void;
}

const formatSeconds = (totalSeconds: number | undefined) => {
    if (totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({ 
  exercise, 
  onClose, 
  history, 
  allExercises,
  exIdx = 0, 
  onApplyHistory, 
  onExerciseSwap, 
  onGoToExercise,
  onEditImage,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'alternatives'>('info');
  const imageSrc = useExerciseImage(exercise);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    return registerBackHandler(onClose);
  }, [onClose]);
  
  const handleEditImage = () => {
    if (onEditImage) {
      onEditImage();
    } else if (onGoToExercise) {
      onClose(); // Close this modal first
      onGoToExercise(exercise.id);
    }
  };

  const stats = useMemo(() => {
    const exerciseHistory = history
      .filter(s => s.exercises && s.exercises.some(e => e.exerciseId === exercise.id))
      .map(s => {
        const ex = s.exercises.find(e => e.exerciseId === exercise.id);
        
        let bestSet: WorkoutSet | undefined;
        let bestValue = 0;
        const trackingType = exercise.trackingType || 'reps_weight';

        if (trackingType === 'time_only' || trackingType === 'time_distance') {
            bestSet = ex?.sets.filter(set => set.completed).sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
            bestValue = bestSet?.duration || 0;
        } else if (trackingType === 'reps_only') {
            bestSet = ex?.sets.filter(set => set.completed).sort((a, b) => (b.reps || 0) - (a.reps || 0))[0];
            bestValue = bestSet?.reps || 0;
        } else { // reps_weight
            bestSet = ex?.sets.filter(set => set.completed).sort((a,b) => (calculate1RM(b.weight || 0, b.reps || 0)) - (calculate1RM(a.weight || 0, a.reps || 0)))[0];
            bestValue = bestSet ? calculate1RM(bestSet.weight || 0, bestSet.reps || 0) : 0;
        }

        return {
          date: s.date,
          bestValue,
          bestSet
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const allTimeBest = exerciseHistory.length > 0 
      ? exerciseHistory.reduce((prev, current) => ((prev.bestValue || 0) > (current.bestValue || 0)) ? prev : current)
      : null;

    return { history: exerciseHistory, best: allTimeBest };
  }, [history, exercise.id, exercise.trackingType]);
  
  const historyItems = useMemo(() => {
    return history
      .filter(s => s.exercises.some(e => e.exerciseId === exercise.id))
      .map(s => {
        const ex = s.exercises.find(e => e.exerciseId === exercise.id);
        const historicalType = ex?.trackingTypeOverride || exercise.trackingType || 'reps_weight';
        return {
          date: s.date,
          sessionName: s.name,
          sets: ex?.sets || [],
          notes: ex?.notes,
          trackingType: historicalType
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Most recent first
      .slice(0, 5); // Visar de 5 senaste gångerna
  }, [history, exercise.id, exercise.trackingType]);

  const alternatives = useMemo(() => {
    if (exercise.alternativeExIds && exercise.alternativeExIds.length > 0) {
        return allExercises.filter(e => exercise.alternativeExIds?.includes(e.id));
    }
    return allExercises.filter(e => 
      e.id !== exercise.id && 
      e.primaryMuscles.some(pm => exercise.primaryMuscles.includes(pm)) &&
      e.equipment.some(eq => exercise.equipment.includes(eq))
    ).slice(0, 5);
  }, [allExercises, exercise]);

  return (
    <div className="fixed inset-0 bg-[#0f0d15] z-[9999] flex flex-col animate-in fade-in duration-200 overscroll-y-contain">
      <header className="flex justify-between items-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] border-b border-white/5 bg-[#0f0d15]">
        <h3 className="text-2xl font-black italic uppercase text-white truncate pr-4">{exercise.name}</h3>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl active:scale-95 transition-transform"><X size={24} className="text-white"/></button>
      </header>
      
      <div className="flex p-4 gap-2 border-b border-white/5 bg-[#0f0d15]">
        <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-text-dim'}`}>Info</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-text-dim'}`}>Historik</button>
        <button onClick={() => setActiveTab('alternatives')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'alternatives' ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-text-dim'}`}>Alternativ</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* --- FLIK 1: INFORMATION --- */}
        {activeTab === 'info' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2">
            
            <div className="w-full bg-white/5 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
              {imageSrc ? (
                <div 
                  onClick={(onGoToExercise || onEditImage) ? handleEditImage : undefined} 
                  className={`relative overflow-hidden ${(onGoToExercise || onEditImage) ? 'cursor-pointer' : ''}`}
                >
                  <img
                    src={imageSrc}
                    alt={exercise.name}
                    className="w-full h-auto max-h-[60vh] object-contain mx-auto transition-transform duration-300 group-hover:scale-105" 
                  />
                  {(onGoToExercise || onEditImage) && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/60 p-3 rounded-full">
                        <Camera size={24} className="text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  onClick={(onGoToExercise || onEditImage) ? handleEditImage : undefined} 
                  className={`h-64 flex flex-col items-center justify-center text-text-dim ${(onGoToExercise || onEditImage) ? 'cursor-pointer hover:bg-white/5 hover:text-accent-blue transition-all' : ''}`}
                >
                  <div className="p-4 rounded-full bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                    <Camera size={40} className="opacity-50 group-hover:opacity-100" />
                  </div>
                  <span className="text-sm font-medium tracking-wide uppercase">Klicka för att lägga till bild</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d15] via-transparent to-transparent opacity-60 pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                  <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-accent-blue/20 border border-accent-blue/30 rounded-lg text-[9px] font-black uppercase text-accent-blue backdrop-blur-sm">
                          {exercise.pattern}
                      </span>
                      <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-[9px] font-black uppercase text-white backdrop-blur-sm">
                          {exercise.tier === 'tier_1' ? 'Basövning' : exercise.tier === 'tier_2' ? 'Komplement' : 'Isolering'}
                      </span>
                  </div>
              </div>
            </div>

            {exercise.description && (
                <div className="bg-[#1a1721] p-5 rounded-3xl border border-white/5">
                    <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-2 flex items-center gap-2">
                        <Info size={12} /> Beskrivning
                    </h4>
                    <p className="text-sm font-medium text-white/80 leading-relaxed">
                        {exercise.description}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1721] p-5 rounded-3xl border border-white/5">
                    <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-3 flex items-center gap-2">
                        <Activity size={12} /> Muskler
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <span className="text-[9px] font-bold text-accent-pink uppercase block mb-1">Primära</span>
                            <div className="flex flex-wrap gap-1.5">
                                {exercise.primaryMuscles.map(m => (
                                    <span key={m} className="text-xs font-bold text-white bg-white/5 px-2 py-1 rounded-md">{m}</span>
                                ))}
                            </div>
                        </div>
                        {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                            <div>
                                <span className="text-[9px] font-bold text-white/40 uppercase block mb-1">Sekundära</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {exercise.secondaryMuscles.map(m => (
                                        <span key={m} className="text-xs font-medium text-white/60 bg-white/5 px-2 py-1 rounded-md">{m}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-[#1a1721] p-5 rounded-3xl border border-white/5">
                    <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-3 flex items-center gap-2">
                        <Dumbbell size={12} /> Utrustning
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {exercise.equipment.map(e => (
                            <span key={e} className="text-xs font-bold text-white bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 w-full text-center">
                                {e}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#1a1721] to-[#13111a] p-6 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={64} /></div>
                <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-4 flex items-center gap-2 relative z-10">
                    <Trophy size={12} className="text-yellow-500" /> Personbästa ({exercise.trackingType === 'reps_weight' ? 'Est. 1RM' : 'Max Tid/Reps'})
                </h4>
                
                {stats.best ? (
                    <div className="relative z-10">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black italic text-white tracking-tighter">
                                {(exercise.trackingType === 'reps_weight' || !exercise.trackingType) ? Math.round(stats.best.bestValue) : stats.best.bestValue}
                            </span>
                            <span className="text-sm font-bold text-text-dim uppercase">
                                {(exercise.trackingType === 'reps_weight' || !exercise.trackingType) ? 'kg' : (exercise.trackingType === 'time_only' || exercise.trackingType === 'time_distance' ? 's' : 'reps')}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-wide bg-white/5 w-fit px-2 py-1 rounded-lg">
                            <Calendar size={10} /> {new Date(stats.best.date).toLocaleDateString('sv-SE')}
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">Bästa setet:</p>
                            <p className="text-sm font-bold text-white">
                                {(exercise.trackingType === 'reps_weight' || !exercise.trackingType) ? `${stats.best.bestSet?.weight}kg x ${stats.best.bestSet?.reps} reps` :
                                 exercise.trackingType === 'time_only' ? `${formatSeconds(stats.best.bestSet?.duration)}` :
                                 exercise.trackingType === 'reps_only' ? `${stats.best.bestSet?.reps} reps` :
                                 `${stats.best.bestSet?.distance}m @ ${formatSeconds(stats.best.bestSet?.duration)}`}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 relative z-10">
                        <p className="text-xs font-bold text-white/30 uppercase">Ingen data registrerad än</p>
                    </div>
                )}
            </div>

          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2">
            {historyItems.length > 0 ? (
              historyItems.map((item, i) => (
                <div key={i} className="bg-[#1a1721] rounded-3xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Calendar size={12} className="text-accent-blue" />
                        <span className="text-[10px] font-black uppercase text-white/90 tracking-widest">
                          {new Date(item.date).toLocaleDateString('sv-SE')}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-text-dim uppercase tracking-wide">{item.sessionName}</p>
                    </div>
                    {onApplyHistory && (
                      <button 
                        onClick={() => onApplyHistory(exIdx, item.sets)} 
                        className="bg-accent-blue/10 text-accent-blue text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw size={10}/> Använd
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    {item.sets.filter(s => s.completed).map((set, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between py-1 border-b border-white/[0.02] last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-text-dim w-4">{sIdx + 1}</span>
                        </div>
                        <div className="flex gap-4">
                          {item.trackingType === 'time_only' ? (
                            <div className="text-right">
                              <span className="text-sm font-black italic text-white">{formatSeconds(set.duration)}</span>
                            </div>
                          ) : item.trackingType === 'time_distance' ? (
                            <div className="text-right">
                                <span className="text-sm font-black italic text-white">{set.distance}m @ {formatSeconds(set.duration)}</span>
                            </div>
                          ) : item.trackingType === 'reps_only' ? (
                            <div className="text-right min-w-[40px]">
                                <span className="text-sm font-black italic text-white">{set.reps}</span>
                                <span className="text-[9px] font-bold text-text-dim uppercase ml-1">reps</span>
                            </div>
                          ) : (
                            <>
                              <div className="text-right">
                                <span className="text-sm font-black italic text-white">{set.weight}</span>
                                <span className="text-[9px] font-bold text-text-dim uppercase ml-1">kg</span>
                              </div>
                              <div className="text-right min-w-[40px]">
                                <span className="text-sm font-black italic text-white">{set.reps}</span>
                                <span className="text-[9px] font-bold text-text-dim uppercase ml-1">reps</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {item.notes && (
                      <div className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={10} className="text-accent-blue" />
                          <span className="text-[8px] font-black uppercase text-accent-blue tracking-widest">Anteckning</span>
                        </div>
                        <p className="text-[10px] font-medium text-white/70 italic leading-relaxed">{item.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center opacity-40">
                <History size={48} className="mx-auto mb-4" strokeWidth={1} />
                <p className="text-xs font-bold uppercase tracking-widest">Ingen historik hittades</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'alternatives' && (
          <div className="space-y-3 animate-in slide-in-from-bottom-2">
             <p className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-2 ml-1">Liknande övningar ({exercise.primaryMuscles?.[0] || 'Okänd'})</p>
             {alternatives.length > 0 ? (
               alternatives.map(alt => (
                 <div key={alt.id} className="bg-[#1a1721] p-4 rounded-2xl border border-white/5 items-center justify-between group flex hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4 overflow-hidden">
                       <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
                           <Shuffle size={20} className="text-white/40" />
                       </div>
                       <div className="min-w-0">
                           <p className="text-sm font-black italic uppercase text-white truncate">{alt.name}</p>
                           <p className="text-[9px] font-bold text-text-dim uppercase tracking-widest truncate">{alt.equipment?.join(', ')}</p>
                       </div>
                    </div>
                    {onExerciseSwap && (
                      <button onClick={() => onExerciseSwap(exIdx, alt.id)} className="bg-white/5 text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 hover:bg-white/10 shrink-0 ml-2">Byt</button>
                    )}
                 </div>
               ))
             ) : (<div className="py-12 text-center opacity-40"><Shuffle size={48} className="mx-auto mb-4" strokeWidth={1} /><p className="text-xs font-bold uppercase tracking-widest">Inga alternativ hittades</p></div>)}
          </div>
        )}
      </div>
    </div>
  );
};