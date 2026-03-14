import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { registerBackHandler } from '../utils/backHandler';

interface TimePickerModalProps {
  title: string;
  totalSeconds: number;
  onClose: () => void;
  onSelect: (seconds: number) => void;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({ title, totalSeconds, onClose, onSelect }) => {
  const [currentTotal, setCurrentTotal] = useState(totalSeconds);
  const [isEditingMins, setIsEditingMins] = useState(false);
  const [manualMinInput, setManualMinInput] = useState("");

  const minScrollRef = useRef<HTMLDivElement>(null);
  const secScrollRef = useRef<HTMLDivElement>(null);

  const mins = Math.floor(currentTotal / 60);
  const secs = currentTotal % 60;

  const minOptions = Array.from({ length: 61 }, (_, i) => i);
  const secOptions = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    const unregister = registerBackHandler(onClose);
    
    const scrollTo = (ref: React.RefObject<HTMLDivElement>, val: number) => {
      if (ref.current) {
        const el = ref.current.querySelector(`[data-value="${val}"]`);
        if (el) el.scrollIntoView({ behavior: 'auto', inline: 'center' });
      }
    };

    setTimeout(() => {
      scrollTo(minScrollRef, mins);
      scrollTo(secScrollRef, secs);
    }, 50);

    return unregister;
  }, []);

  const handleSave = () => {
    onSelect(currentTotal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl overflow-hidden p-8 flex flex-col items-center">
        <header className="w-full flex justify-between items-center mb-6">
          <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Ange Tid</h3>
          <button onClick={onClose} className="p-2 text-white/40"><X size={24}/></button>
        </header>

        {/* Digital display för Ange Tid */}
        <div className="flex items-baseline gap-2 mb-8">
          <div className="flex flex-col items-center">
            {isEditingMins ? (
              <input
                type="number"
                autoFocus
                onFocus={(e) => e.target.select()}
                className="w-20 bg-transparent text-6xl font-black italic text-accent-blue text-center outline-none border-b-2 border-accent-blue"
                value={manualMinInput}
                onChange={(e) => setManualMinInput(e.target.value)}
                onBlur={() => {
                  const val = parseInt(manualMinInput);
                  if (!isNaN(val)) setCurrentTotal((val * 60) + (currentTotal % 60));
                  setIsEditingMins(false);
                }}
              />
            ) : (
              <button onClick={() => { setManualMinInput(mins.toString()); setIsEditingMins(true); }} className="text-6xl font-black italic text-white tracking-tighter">
                {mins}
              </button>
            )}
            <span className="text-[10px] font-black text-text-dim uppercase">MIN</span>
          </div>
          <span className="text-4xl font-black text-white/20">:</span>
          <div className="flex flex-col items-center">
            <div className="text-6xl font-black italic text-white tracking-tighter">{secs.toString().padStart(2, '0')}</div>
            <span className="text-[10px] font-black text-text-dim uppercase">SEK</span>
          </div>
        </div>

        {/* Scroll Väljare */}
        <div className="w-full space-y-6 mb-8">
          <div>
            <label className="text-[9px] font-black uppercase text-accent-blue tracking-widest mb-2 block text-center">Välj Minuter</label>
            <div ref={minScrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-[40%]">
              {minOptions.map(m => (
                <button key={m} data-value={m} onClick={() => setCurrentTotal((m * 60) + (currentTotal % 60))} 
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black snap-center transition-all ${m === mins ? 'bg-accent-blue text-black' : 'bg-white/5 text-text-dim'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-accent-pink tracking-widest mb-2 block text-center">Välj Sekunder</label>
            <div ref={secScrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-[40%]">
              {secOptions.map(s => (
                <button key={s} data-value={s} onClick={() => setCurrentTotal((Math.floor(currentTotal / 60) * 60) + s)} 
                  className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black snap-center transition-all ${s === secs ? 'bg-accent-pink text-white' : 'bg-white/5 text-text-dim'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleSave} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase italic tracking-widest active:scale-95 transition-all">
          Spara Tid
        </button>
      </div>
    </div>
  );
};