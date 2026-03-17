import React from 'react';
import { EXERCISE_COLORS } from '../utils/colors';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  selectedColor?: string;
  onSelectColor: (hex: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="grid grid-cols-5 gap-2 p-4 bg-[#0f0d15] rounded-2xl border border-white/10">
      <p className="col-span-5 text-[9px] font-black uppercase tracking-widest text-text-dim mb-1">
        Välj färg
      </p>
      {EXERCISE_COLORS.map((color) => (
        <button
          key={color.hex}
          onClick={() => onSelectColor(color.hex)}
          className={`
            w-10 h-10 rounded-lg transition-all relative
            ${color.bg}
            ${selectedColor === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f0d15] scale-105' : 'hover:scale-105'}
          `}
          title={color.name}
        >
          {selectedColor === color.hex && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Check size={16} className={color.hex === '#000000' || color.hex === '#1a1721' ? 'text-white' : 'text-black'} strokeWidth={3} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
