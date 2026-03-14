
import React, { useMemo, useEffect } from 'react';
import { WorkoutSession, Exercise, WorkoutSet, TrackingType } from '../types';
import { X, MapPin, Activity, Zap, Trophy, MessageSquare, Calendar, Clock } from 'lucide-react';
import { calculate1RM } from '../utils/fitness';

const formatSeconds = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
  
const calculatePace = (timeInSeconds: number, distanceInMeters: number) => {
    if (!distanceInMeters || !timeInSeconds) return null;
    const paceInSecondsPerKm = (timeInSeconds / distanceInMeters) * 1000;
    const mins = Math.floor(paceInSecondsPerKm / 60);
    const secs = Math.round(paceInSecondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
};

const HistoryLogSetRow: React.FC<{ set: WorkoutSet; type: TrackingType | undefined; isPR: boolean; }> = ({ set, type, isPR }) => {
    const oneRM = (type === 'reps_weight' || !type) ? calculate1RM(set.weight, set.reps) : 0;
    
    const renderTypeBadge = () => {
      switch (set.type) {
        case 'warmup': return <span className="text-[8px] px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue rounded uppercase">W</span>;
        case 'failure': return <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-500 rounded uppercase">F</span>;
        case 'drop': return <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/20 text-orange-500 rounded uppercase">D</span>;
        default: return null; 
      }
    };
  
    return (
      <div className={`bg-black/20 p-2.5 rounded-xl flex justify-between items-center text-xs font-bold border ${isPR ? 'border-accent-pink/30' : 'border-transparent'}`}>
        <div className="flex items-center gap-2">
          {renderTypeBadge()}
          {isPR && (<div className="flex items-center gap-1 bg-accent-pink/10 text-accent-pink px-1.5 py-0.5 rounded-md"><Trophy size={10} /><span className="text-[8px] uppercase font-black">PR</span></div>)}
        </div>
        <div className="flex items-center gap-4">
          {oneRM > 0 && (<span className="text-accent-blue/60 uppercase text-[9px] font-black">est. 1RM: {oneRM}kg</span>)}
          <div className="text-right">
            {type === 'reps_weight' || !type ? (<span className="text-white">{set.reps} × {set.weight}kg</span>) : 
             type === 'time_distance' ? (<div className="text-right"><span className="text-white">{set.distance}m @ {formatSeconds(set.duration || 0)}</span>{calculatePace(set.duration || 0, set.distance || 0) && (<p className="text-[8px] text-accent-blue uppercase font-black">{calculatePace(set.duration || 0, set.distance || 0)}</p>)}</div>) : 
             type === 'time_only' ? (<span className="text-white">{formatSeconds(set.duration || 0)}</span>) : 
             (<span className="text-white">{set.reps} reps</span>)}
          </div>
        </div>
      </div>
    );
};

interface HistoryItemModalProps {
    session: WorkoutSession;
    allExercises: Exercise[];
    history: WorkoutSession[];
    onClose: () => void;
}

export const HistoryItemModal: React.FC<HistoryItemModalProps> = ({ session, allExercises, history, onClose }) => {
    
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);
    
    const checkIsPR = useMemo(() => (exerciseId: string, weight: number, reps: number, sessionDate: string) => {
        const current1RM = calculate1RM(weight, reps);
        if (current1RM === 0) return false;
        const earlierHistory = history.filter((h: any) => new Date(h.date) < new Date(sessionDate));
        for (const pastSession of earlierHistory) {
          const ex = pastSession.exercises.find((e: any) => e.exerciseId === exerciseId);
          if (ex) {
            for (const set of ex.sets) {
              if (calculate1RM(set.weight || 0, set.reps || 0) >= current1RM) return false;
            }
          }
        }
        return true;
    }, [history]);

    const endTime = session.duration ? new Date(new Date(session.date).getTime() + session.duration * 1000) : null;
    const endTimeString = endTime ? endTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1721] w-full max-w-md max-h-[85vh] flex flex-col rounded-[40px] border border-white/10 shadow-2xl animate-in zoom-in-95">
                <div className="p-8 border-b border-white/5 flex justify-between items-start">
                    <div>
                        <span className="text-[10px] text-accent-green font-black uppercase tracking-widest mb-2 block">Loggat Pass</span>
                        <h3 className="text-2xl font-black italic text-white uppercase leading-tight pr-4">{session.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
                            <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> {new Date(session.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                            {session.isManual ? (
                                <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> Efterhand</span>
                            ) : endTimeString && (
                                <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> {endTimeString}</span>
                            )}
                            {session.locationName && (<span className="text-[10px] text-text-dim font-bold uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12}/> {session.locationName}</span>)}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white shrink-0"><X size={24} /></button>
                </div>
                <div className="p-8 pt-4 overflow-y-auto flex-1 space-y-6 scrollbar-hide overscroll-contain">
                    {(session.feeling || session.rpe) && (
                        <div className="flex flex-wrap gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                            {session.feeling && (<div className="flex items-center gap-2"><Activity size={14} className="text-accent-pink" /><span className="text-[10px] font-black uppercase text-white tracking-widest">{session.feeling}</span></div>)}
                            {session.rpe && (<div className="flex items-center gap-2"><Zap size={14} className="text-accent-blue" /><span className="text-[10px] font-black uppercase text-white tracking-widest">Ansträngning: {session.rpe}/10</span></div>)}
                        </div>
                    )}
                    <div className="space-y-6">
                        {session.exercises.map((ex, idx) => {
                            const exData = allExercises.find(e => e.id === ex.exerciseId);
                            return (
                                <div key={idx} className="space-y-3">
                                <div className="flex justify-between items-baseline gap-4"><span className="text-sm font-black uppercase italic text-accent-pink tracking-tight shrink-0">{exData?.name || 'Övning'}</span>{ex.notes && (<div className="flex items-center gap-1.5 opacity-60 min-w-0 text-right"><MessageSquare size={10} className="text-text-dim shrink-0" /><span className="text-[9px] font-bold text-text-dim italic truncate">{ex.notes}</span></div>)}</div>
                                <div className="space-y-1.5">
                                    {ex.sets.filter(s => s.completed).map((set, sIdx) => (<HistoryLogSetRow key={sIdx} set={set} type={ex.trackingTypeOverride || exData?.trackingType} isPR={checkIsPR(ex.exerciseId, set.weight, set.reps, session.date)} />))}
                                </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
