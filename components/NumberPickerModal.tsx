
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, ChevronUp, ChevronDown, Scale } from 'lucide-react';
import { PlateDisplay } from './PlateDisplay';
import { UserProfile } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { registerBackHandler } from '../utils/backHandler';

interface NumberPickerModalProps {
  title: string;
  unit: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  barWeight?: number;
  availablePlates?: number[];
  onSave: (value: number) => void;
  onClose: () => void;
  userProfile?: UserProfile;
}

export const NumberPickerModal: React.FC<NumberPickerModalProps> = ({
  title, unit, value, step = 1, min = 0, max = 99999, precision = 2, barWeight = 0, onSave, onClose, availablePlates, userProfile
}) => {
  const [localVal, setLocalVal] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return registerBackHandler(onClose);
  }, [onClose]);

  const handleFinalSave = () => {
    const num = localVal || 0;
    
    // Special rounding for barbell exercises
    if (unit === 'kg' && barWeight > 0 && step === 2.5) {
        const plateWeight = num - barWeight;
        if (plateWeight > 0) {
            const roundedPlateWeight = Math.round(plateWeight / 2.5) * 2.5;
            const finalWeight = barWeight + roundedPlateWeight;
            onSave(Math.max(min, Math.min(max, finalWeight)));
        } else {
            onSave(Math.max(min, Math.min(max, barWeight)));
        }
    } else {
        const rounded = precision === 0 ? Math.round(num) : parseFloat(num.toFixed(precision));
        onSave(Math.max(min, Math.min(max, rounded)));
    }
  };

  // --- METER-SPECIFIC UI ---
  if (unit === 'm') {
    const m_step = 50;
    const m_max = 10000;
    const options = useMemo(() => {
      const opts = [];
      for (let i = 0; i <= m_max; i += m_step) {
        opts.push(i);
      }
      return opts;
    }, []);
    
    const formatDisplayValue = (val: number) => {
      if (val >= 1000) {
        const km = val / 1000;
        return `${km.toLocaleString('sv-SE')} Km`;
      }
      return val.toString();
    };

    useEffect(() => {
        if (scrollRef.current && !isEditing) {
            // Find closest option to scroll to
            const closest = Math.round(localVal / m_step) * m_step;
            const el = scrollRef.current.querySelector(`[data-value="${closest}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    }, [localVal, isEditing]);

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 animate-in fade-in duration-200">
        <div className="absolute inset-0 bg-[#0f0d15]/95 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-[#1a1721] rounded-[40px] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-8 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">{title}</h3>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-text-dim hover:text-white transition-colors"><X size={20}/></button>
          </div>
          
          <div className="text-center mb-10 flex items-baseline justify-center gap-2 h-20">
            {isEditing ? (
              <input
                type="number"
                autoFocus
                onFocus={(e) => e.target.select()}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onBlur={() => {
                  const val = parseInt(manualInput);
                  if (!isNaN(val)) setLocalVal(Math.max(min, Math.min(max, val)));
                  setIsEditing(false);
                }}
                className="w-48 bg-transparent text-5xl font-black italic text-accent-blue text-center outline-none border-b-2 border-accent-blue"
              />
            ) : (
              <button 
                onClick={() => { setManualInput(localVal.toString()); setIsEditing(true); }}
                className="text-5xl font-black italic text-accent-blue hover:scale-105 transition-transform"
              >
                {formatDisplayValue(localVal)}
              </button>
            )}
            {!isEditing && localVal < 1000 && <span className="text-xl uppercase not-italic text-text-dim">m</span>}
          </div>

          <div ref={scrollRef} className="w-full flex gap-4 overflow-x-auto pb-8 scrollbar-hide snap-x snap-mandatory px-[40%] mb-6">
            {options.map((opt) => (
              <button key={opt} data-value={opt} onClick={() => setLocalVal(opt)} className={`flex-shrink-0 min-w-[64px] h-16 px-4 rounded-2xl flex items-center justify-center text-sm font-black snap-center transition-all ${opt === localVal ? 'bg-accent-blue text-black scale-125 shadow-lg' : 'bg-white/5 text-text-dim'}`}>
                {formatDisplayValue(opt)}
              </button>
            ))}
          </div>
          <button onClick={() => { onSave(localVal); onClose(); }} className="w-full py-5 bg-white text-black rounded-[24px] font-black italic uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Check size={24} strokeWidth={4} /> Spara
          </button>
        </div>
      </div>
    );
  }

  // --- UI FOR KG & REPS ---
  const quickWeights = Array.from({ length: 30 }, (_, i) => (i + 1) * 5);
  const quickReps = Array.from({ length: 50 }, (_, i) => i + 1);

  const scrollToCurrent = (val: number, behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      const isKg = unit === 'kg';
      const closestQuickValue = isKg ? Math.round(val / 5) * 5 : Math.round(val);
      const elementId = isKg ? `quick-weight-${closestQuickValue}` : `quick-rep-${closestQuickValue}`;
      const element = scrollRef.current.querySelector(`[id="${elementId}"]`);
      if (element) {
        element.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
      }
    }
  };
  
  useEffect(() => {
    const timer = setTimeout(() => scrollToCurrent(localVal, 'auto'), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleStepChange = (delta: number) => {
    const newValue = Math.max(0, localVal + delta);
    setLocalVal(newValue);
    scrollToCurrent(newValue);
    if (userProfile && newValue !== localVal) {
      triggerHaptic.tick(userProfile);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-[#0f0d15]/95 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#1a1721] rounded-[40px] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] p-6 animate-in zoom-in-95 duration-300">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-text-dim hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <button onClick={() => handleStepChange(-step)} className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-xl font-bold text-white active:scale-90 transition-transform flex items-center justify-center">
            -{step}
          </button>
          <div className="text-center">
            <span className="text-6xl font-black text-white italic tracking-tighter">
              {localVal % 1 === 0 ? localVal : localVal.toFixed(1)}
            </span>
            <span className="text-text-dim ml-2 font-bold uppercase text-xs">{unit}</span>
          </div>
          <button onClick={() => handleStepChange(step)} className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-xl font-bold text-white active:scale-90 transition-transform flex items-center justify-center">
            +{step}
          </button>
        </div>
        
        {unit === 'kg' && barWeight > 0 && <PlateDisplay weight={localVal} barWeight={barWeight} availablePlates={availablePlates} />}
        
        {(unit === 'kg' || unit === 'reps') ? (
          <div className="my-8 relative">
            <div className="flex justify-between items-center mb-3 px-1">
              <p className="text-[10px] text-text-dim font-bold uppercase tracking-wider">Dra för att snabbspola</p>
              <span className="text-[10px] text-accent-blue font-black uppercase">{unit === 'kg' ? '5kg intervall' : '1 rep intervall'}</span>
            </div>
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-6 pt-2 px-10 scrollbar-hide snap-x" style={{ scrollbarWidth: 'none' }}>
              {(unit === 'kg' ? quickWeights : quickReps).map((val) => {
                const isSelected = (unit === 'kg' ? Math.round(localVal / 5) * 5 : Math.round(localVal)) === val;
                return (
                  <button key={val} id={unit === 'kg' ? `quick-weight-${val}` : `quick-rep-${val}`} onClick={() => { setLocalVal(val); scrollToCurrent(val); }} className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 snap-center flex flex-col items-center justify-center transition-all duration-300 ${isSelected ? 'bg-accent-blue border-accent-blue text-white scale-110 shadow-xl shadow-accent-blue/30 z-10' : 'bg-white/5 border-white/10 text-text-dim scale-90 opacity-60'}`}>
                    <span className="text-lg font-black">{val}</span>
                    <span className="text-[8px] font-bold uppercase opacity-60">{unit}</span>
                  </button>
                );
              })}
            </div>
            <div className="absolute left-0 top-8 bottom-8 w-10 bg-gradient-to-r from-[#1a1721] to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-8 bottom-8 w-10 bg-gradient-to-l from-[#1a1721] to-transparent pointer-events-none z-10" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <button onClick={onClose} className="py-4 rounded-2xl bg-white/5 text-text-dim font-bold uppercase tracking-widest text-xs active:bg-white/10 transition-colors">Avbryt</button>
          <button onClick={handleFinalSave} className="py-4 rounded-2xl bg-accent-blue text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-blue/20 active:scale-95 transition-all">Bekräfta</button>
        </div>
      </div>
    </div>
  );
};
