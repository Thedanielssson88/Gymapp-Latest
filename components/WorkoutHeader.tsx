import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, Save, History } from 'lucide-react';

interface WorkoutHeaderProps {
  timer: number;
  isTimerActive: boolean;
  onToggleTimer: () => void;
  onCancel: () => void;
  onSaveRoutine: () => void;
  sessionName: string;
  onUpdateSessionName: (name: string) => void;
  isManual?: boolean; // NEW: Manual mode prop
}

export const WorkoutHeader: React.FC<WorkoutHeaderProps> = ({
  timer,
  isTimerActive,
  onToggleTimer,
  onCancel,
  onSaveRoutine,
  sessionName,
  onUpdateSessionName,
  isManual = false
}) => {
  const [editableSessionName, setEditableSessionName] = useState(sessionName);

  useEffect(() => {
    setEditableSessionName(sessionName);
  }, [sessionName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setEditableSessionName(newName);
    onUpdateSessionName(newName);
  };

  return (
    <header 
      className="bg-[#1a1721] p-6 border-b border-white/5 flex justify-between items-start" 
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}
    >
      <div className="flex items-center gap-4">
        {isManual ? (
          <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20">
             <History size={24} />
          </div>
        ) : (
          <button 
            onClick={onToggleTimer}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isTimerActive ? 'bg-accent-pink/20 text-accent-pink shadow-[0_0_15px_rgba(255,45,85,0.2)]' : 'bg-white/5 text-white/40'}`}
          >
             {isTimerActive ? <Pause size={24} /> : <Play size={24} />}
          </button>
        )}
        <div>
          <input 
            type="text"
            value={editableSessionName}
            onChange={handleNameChange}
            placeholder="Passets namn"
            className="bg-transparent text-xl font-black italic text-white leading-none outline-none focus:border-b-2 focus:border-accent-pink pb-1 w-full"
          />
          <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] block mt-1">
            {isManual ? 'Efterregistrering' : `Workout Timer: ${Math.floor(timer/60)}:${String(timer%60).padStart(2,'0')}`}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onCancel}
          className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 active:scale-95 transition-all"
        >
          <Trash2 size={24} />
        </button>
        <button 
          onClick={onSaveRoutine}
          className="p-3 bg-white/5 rounded-xl border border-white/5 text-white/60 hover:text-white transition-all flex items-center gap-2 active:scale-95"
        >
           <Save size={18} />
           <span className="text-[10px] font-black uppercase">Spara Mall</span>
        </button>
      </div>
    </header>
  );
};