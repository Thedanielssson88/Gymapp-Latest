
import React from 'react';
import { calculatePlates, AVAILABLE_PLATES } from '../utils/plates';

interface PlateDisplayProps {
  weight: number;
  barWeight: number;
  availablePlates?: number[];
}

export const PlateDisplay: React.FC<PlateDisplayProps> = ({ weight, barWeight, availablePlates }) => {
  if (weight < barWeight) {
    return (
      <div className="mt-4 py-2 px-4 bg-red-500/10 rounded-xl border border-red-500/20 animate-in fade-in zoom-in-95">
        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">
          Vikten är mindre än stången!
        </p>
      </div>
    );
  }

  if (weight === barWeight) {
    return (
      <div className="mt-4 py-2 px-4 bg-white/5 rounded-xl border border-white/5 animate-in fade-in zoom-in-95">
        <p className="text-[10px] font-black text-text-dim uppercase tracking-widest text-center">
          Endast stången ({barWeight}kg)
        </p>
      </div>
    );
  }

  const plates = calculatePlates(weight, barWeight, availablePlates || AVAILABLE_PLATES);
  const weightPerSide = ((weight - barWeight) / 2).toFixed(2).replace(/\.00$/, '').replace('.25',',25').replace('.50','.5').replace('.75',',75');

  return (
    <div className="mt-6 w-full animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-black text-text-dim uppercase tracking-widest w-full text-center mb-2">
          Lasta {weightPerSide}kg per sida (på {barWeight}kg stång)
        </span>
        {plates.map((plateGroup, groupIdx) => (
          <React.Fragment key={groupIdx}>
            {Array.from({ length: plateGroup.count }).map((_, i) => (
              <div 
                key={`${groupIdx}-${i}`}
                className="group relative flex flex-col items-center"
              >
                <div 
                  className="h-10 px-2 min-w-[32px] rounded-lg flex items-center justify-center border-l-4 shadow-lg transition-transform hover:scale-110 active:scale-95"
                  style={{ 
                    backgroundColor: plateGroup.color,
                    borderColor: 'rgba(0,0,0,0.2)',
                    color: plateGroup.weight >= 5 && plateGroup.weight !== 5 ? 'white' : 'black'
                  }}
                >
                  <span className="text-[10px] font-black italic">{plateGroup.weight.toString().replace('.',',')}</span>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};