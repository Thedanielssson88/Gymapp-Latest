import React from 'react';
import { Equipment } from '../types';
import { Plus, X, Trash2 } from 'lucide-react';

interface EquipmentBuilderProps {
  value: Equipment[][];
  onChange: (newReqs: Equipment[][]) => void;
}

const ALL_EQUIPMENT = Object.values(Equipment);

export const EquipmentBuilder: React.FC<EquipmentBuilderProps> = ({ value, onChange }) => {
  const addGroup = () => {
    onChange([...value, []]);
  };

  const removeGroup = (groupIdx: number) => {
    const next = value.filter((_, i) => i !== groupIdx);
    onChange(next);
  };

  const addOptionToGroup = (groupIdx: number, eq: Equipment) => {
    const next = [...value];
    if (!next[groupIdx].includes(eq)) {
      next[groupIdx] = [...next[groupIdx], eq];
      onChange(next);
    }
  };

  const removeOption = (groupIdx: number, eqToRemove: Equipment) => {
    const next = [...value];
    next[groupIdx] = next[groupIdx].filter(e => e !== eqToRemove);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">Utrustningslogik</label>
        <button 
          onClick={addGroup}
          className="text-[10px] font-black uppercase bg-accent-blue/10 text-accent-blue px-3 py-1.5 rounded-lg border border-accent-blue/20 hover:bg-accent-blue/20 transition-all"
        >
          + Lägg till kravgrupp (OCH)
        </button>
      </div>

      {value.length === 0 && (
        <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl text-center">
          <p className="text-[10px] text-text-dim font-bold uppercase italic">
            Inga specifika krav definierade.<br/>
            (Alla valda redskap i grundlistan krävs)
          </p>
        </div>
      )}

      {value.map((group, groupIdx) => (
        <div key={groupIdx} className="bg-black/20 p-4 rounded-2xl border border-white/10 relative animate-in fade-in slide-in-from-left-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase text-accent-green tracking-widest bg-accent-green/10 px-2 py-1 rounded">
              GRUPP {groupIdx + 1}
            </span>
            <button onClick={() => removeGroup(groupIdx)} className="text-text-dim hover:text-red-500 p-1">
              <Trash2 size={14} />
            </button>
          </div>
          
          <p className="text-[10px] text-white/40 font-bold uppercase mb-3 ml-1 italic">
            Kräv minst ett av följande (ELLER):
          </p>

          <div className="flex flex-wrap gap-2 mb-4 min-h-[30px]">
            {group.map(eq => (
              <span key={eq} className="text-[10px] font-bold bg-white/5 border border-white/10 pl-3 pr-2 py-1.5 rounded-lg flex items-center gap-2 text-white shadow-sm">
                {eq}
                <button onClick={() => removeOption(groupIdx, eq)} className="text-white/20 hover:text-red-500 transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
            {group.length === 0 && <span className="text-[10px] text-red-400 italic font-bold">Tom grupp - lägg till redskap nedan</span>}
          </div>

          <select 
            className="w-full bg-white/5 text-white text-xs font-bold p-3 rounded-xl outline-none border border-white/10 focus:border-accent-blue/50 appearance-none"
            onChange={(e) => {
              if (e.target.value) {
                addOptionToGroup(groupIdx, e.target.value as Equipment);
                e.target.value = ""; 
              }
            }}
          >
            <option value="" className="bg-[#1a1721]">+ Välj redskap...</option>
            {ALL_EQUIPMENT.map(eq => (
              <option key={eq} value={eq} className="bg-[#1a1721]">{eq}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};