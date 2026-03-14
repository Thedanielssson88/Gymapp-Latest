import React, { useEffect } from 'react';
import { Dumbbell, Timer, Ruler, Hash, X, RefreshCw, Scale } from 'lucide-react';
import { TrackingType } from '../types';
import { registerBackHandler } from '../utils/backHandler';

interface TypeSelectorModalProps {
  currentType: TrackingType;
  onSelect: (type: TrackingType) => void;
  onClose: () => void;
}

export const TypeSelectorModal: React.FC<TypeSelectorModalProps> = ({ currentType, onSelect, onClose }) => {
  const options: { type: TrackingType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'reps_weight', label: 'Reps & Vikt', icon: <Dumbbell size={20} />, desc: 'Standardstyrka (t.ex. Bänkpress)' },
    { type: 'reps_only', label: 'Enbart Reps', icon: <Hash size={20} />, desc: 'Kroppsvikt (t.ex. Armhävningar)' },
    { type: 'time_only', label: 'Enbart Tid', icon: <Timer size={20} />, desc: 'Statisk träning (t.ex. Plankan)' },
    { type: 'time_distance', label: 'Distans & Tid', icon: <Ruler size={20} />, desc: 'Cardio (t.ex. Löpning, Rodd)' },
    { type: 'distance_weight', label: 'Distans & Vikt', icon: <Scale size={20} />, desc: 'Bärövningar (t.ex. Farmers Carry)' },
    { type: 'reps_time_weight', label: 'Reps på Tid', icon: <RefreshCw size={20} />, desc: 'AMRAP / CrossFit (t.ex. Kettlebell Swing)' },
  ];

  useEffect(() => {
    return registerBackHandler(onClose);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#1a1721] w-full max-w-sm rounded-[32px] border border-white/10 overflow-hidden shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-black italic uppercase text-white">Byt Mätmetod</h3>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="text-white/60" /></button>
        </div>
        
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                currentType === opt.type 
                  ? 'bg-accent-blue text-black shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`p-3 rounded-lg ${currentType === opt.type ? 'bg-black/10' : 'bg-white/5'}`}>
                {opt.icon}
              </div>
              <div className="text-left">
                <div className="font-black uppercase text-sm tracking-wider">{opt.label}</div>
                <div className={`text-xs ${currentType === opt.type ? 'text-black/70 font-medium' : 'text-text-dim'}`}>
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
