
import React, { useState, useEffect } from 'react';
import { X, Play, Calendar, Repeat, ArrowRightLeft } from 'lucide-react';
import { ScheduledActivity, Exercise } from '../types';
import { storage } from '../services/storage';

interface WorkoutDetailsModalProps {
  activity: ScheduledActivity;
  allExercises: Exercise[];
  onClose: () => void;
  onStart: (activity: ScheduledActivity) => void;
  onUpdate?: () => void;
}

export const WorkoutDetailsModal: React.FC<WorkoutDetailsModalProps> = ({ activity, allExercises, onClose, onStart, onUpdate }) => {
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(activity.date);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const getExerciseName = (exerciseId: string) => {
    return allExercises.find(ex => ex.id === exerciseId)?.name || exerciseId;
  };

  const handleReschedule = async (moveAll: boolean) => {
    if (!newDate) return;

    if (moveAll && activity.programId) {
        await storage.rescheduleAIProgram(activity.programId, activity.id, newDate);
        alert("Schemat uppdaterat! Alla efterföljande pass har flyttats.");
    } else {
        // Move only this one
        const updated = { ...activity, date: newDate };
        await storage.addScheduledActivity(updated);
        alert("Passet flyttat.");
    }
    
    if (onUpdate) onUpdate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1721] w-full max-w-md max-h-[85vh] flex flex-col rounded-[40px] border border-white/10 shadow-2xl animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-white/5 to-transparent rounded-t-[40px]">
          <div>
            <span className="text-[10px] text-accent-blue font-black uppercase tracking-widest mb-2 block">
              AI Program Details
            </span>
            <h3 className="text-2xl font-black italic text-white uppercase leading-tight pr-4">
              {activity.title}
            </h3>
            
            {showReschedule ? (
                <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-white/10 animate-in slide-in-from-top-2">
                    <label className="text-[9px] font-black uppercase text-text-dim block mb-2">Välj nytt datum</label>
                    <input 
                        type="date" 
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full bg-[#1a1721] text-white p-4 rounded-xl border border-white/10 mb-4 outline-none focus:border-accent-blue font-bold"
                    />
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => handleReschedule(false)}
                            className="w-full py-3 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                        >
                            Flytta bara detta pass
                        </button>
                        {activity.programId && (
                            <button 
                                onClick={() => handleReschedule(true)}
                                className="w-full py-3 rounded-xl bg-accent-blue text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                            >
                                <Repeat size={14} strokeWidth={3} /> Flytta detta & kommande pass
                            </button>
                        )}
                        <button onClick={() => setShowReschedule(false)} className="text-[9px] font-bold text-text-dim uppercase mt-1">Avbryt</button>
                    </div>
                </div>
            ) : (
                <button 
                  onClick={() => setShowReschedule(true)}
                  className="flex items-center gap-2 text-xs font-bold text-text-dim mt-3 bg-white/5 px-3 py-1.5 rounded-lg hover:text-accent-blue hover:bg-accent-blue/10 transition-all"
                >
                  <Calendar size={14} /> Planerat: {activity.date} <ArrowRightLeft size={10} className="ml-1" />
                </button>
            )}
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white shrink-0">
            <X size={24} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-8 overflow-y-auto flex-1 space-y-4 scrollbar-hide overscroll-contain">
          <p className="text-[10px] font-black uppercase text-text-dim tracking-[0.2em] mb-4">Övningslista</p>
          {(activity.exercises || []).map((plannedEx, idx) => (
            <div key={idx} className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
              <div>
                <p className="text-base font-black italic text-white uppercase mb-1">
                   {getExerciseName(plannedEx.exerciseId)}
                </p>
                <div className="flex gap-4 text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Repeat size={12} className="text-accent-blue"/> {plannedEx.sets.length} set</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-white">{plannedEx.sets[0]?.reps} reps</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-accent-blue font-black text-xl block italic">
                  {plannedEx.sets[0]?.weight ? `${plannedEx.sets[0].weight}kg` : '-'}
                </span>
                <span className="text-[8px] text-text-dim font-black uppercase tracking-widest">Est. vikt</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer / Action */}
        <div className="p-8 border-t border-white/5 bg-[#1a1721] rounded-b-[40px]">
          <button 
            onClick={() => onStart(activity)}
            className="w-full bg-[#2ed573] hover:bg-[#26b963] text-black font-black py-5 rounded-3xl uppercase tracking-[0.15em] text-lg flex items-center justify-center gap-3 shadow-2xl shadow-green-500/20 transition-all active:scale-[0.98]"
          >
            <Play size={24} fill="black" /> STARTA PASS NU
          </button>
          <p className="text-[9px] font-bold text-text-dim text-center mt-4 uppercase tracking-widest opacity-40">
            Passet startas med dagens datum
          </p>
        </div>

      </div>
    </div>
  );
};
