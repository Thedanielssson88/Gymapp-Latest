
import React, { useState, useEffect } from 'react';
import { Zone, Equipment } from '../types';
import { storage } from '../services/storage';
import { Plus, Edit2, X, Check, Save, Dumbbell, Home, Trees, Briefcase, Building2, Scale } from 'lucide-react';
import { registerBackHandler } from '../utils/backHandler';

// --- DEFINIERA KATEGORIERNA HÄR ---
const EQUIPMENT_CATEGORIES = [
  {
    title: "Grundläggande & Kroppsvikt",
    description: "Det absolut viktigaste för att komma igång.",
    items: [
      Equipment.BODYWEIGHT,
      Equipment.PULLUP_BAR,
      Equipment.BENCH,
      Equipment.DIP_STATION,
      Equipment.BOX
    ]
  },
  {
    title: "Fria Vikter",
    description: "Skivstänger, hantlar och vikter.",
    items: [
      Equipment.BARBELL,
      Equipment.DUMBBELL,
      Equipment.KETTLEBELL,
      Equipment.EZ_BAR,
      Equipment.TRAP_BAR,
      Equipment.PLATE
    ]
  },
  {
    title: "Maskiner: Ben",
    description: "Tunga maskiner för underkroppen.",
    items: [
      Equipment.LEG_PRESS,
      Equipment.HACK_SQUAT,
      Equipment.LEG_EXTENSION,
      Equipment.LEG_CURL,
      Equipment.CALF_RAISE,
      Equipment.SMITH_MACHINE
    ]
  },
  {
    title: "Maskiner: Överkropp",
    description: "Kablar och pressmaskiner.",
    items: [
      Equipment.CABLES,
      Equipment.LAT_PULLDOWN,
      Equipment.SEATED_ROW,
      Equipment.CHEST_PRESS,
      Equipment.SHOULDER_PRESS,
      Equipment.PEC_DECK,
      Equipment.ASSISTED_MACHINE
    ]
  },
  {
    title: "Funktionellt & Övrigt",
    description: "Gummiband, TRX och annat.",
    items: [
      Equipment.BANDS,
      Equipment.TRX,
      Equipment.MEDICINE_BALL,
      Equipment.MACHINES // Fallback för gamla/övriga maskiner
    ]
  }
];

interface LocationManagerProps {
    zones: Zone[];
    onUpdate: () => void;
}

export const LocationManager: React.FC<LocationManagerProps> = ({ zones, onUpdate }) => {
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  useEffect(() => {
    if (editingZone) {
      return registerBackHandler(() => {
        setEditingZone(null);
      });
    }
  }, [editingZone]);

  const handleSave = async (zone: Zone) => {
    await storage.saveZone(zone);
    setEditingZone(null);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Är du säker på att du vill ta bort denna plats?")) {
      await storage.deleteZone(id);
      setEditingZone(null);
      onUpdate();
    }
  };

  const createNew = () => {
    setEditingZone({
      id: `zone-${Date.now()}`,
      name: '',
      icon: 'building',
      inventory: [Equipment.BODYWEIGHT], // Alltid kroppsvikt som default
      availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25] // Standarduppsättning
    });
  };

  const getIcon = (zone: Zone) => {
    if (zone.name.toLowerCase().includes('hem')) return <Home size={32} />;
    if (zone.name.toLowerCase().includes('resa')) return <Briefcase size={32} />;
    if (zone.name.toLowerCase().includes('ute')) return <Trees size={32} />;
    if (zone.name.toLowerCase().includes('gym')) return <Building2 size={32} />;
    return <Dumbbell size={32} />;
  };

  return (
    <div className="pb-32 animate-in fade-in space-y-6 px-4 pt-8">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Mina Platser</h2>
          <p className="text-text-dim text-xs font-bold uppercase tracking-widest">Hantera utrustning & gym</p>
        </div>
        <button 
          onClick={createNew}
          className="p-4 bg-accent-pink text-white rounded-2xl shadow-lg active:scale-95 transition-all"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      </header>

      {/* LISTA MED PLATSER */}
      <div className="space-y-4">
        {zones.map(zone => (
          <div key={zone.id} onClick={() => setEditingZone(zone)} className="bg-[#1a1721] p-6 rounded-[32px] border border-white/5 flex items-center justify-between group active:scale-95 transition-all cursor-pointer">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-accent-blue border border-white/5">
                 {getIcon(zone)}
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase">{zone.name}</h3>
                <p className="text-[10px] text-text-dim uppercase tracking-widest mt-1">
                  {zone.inventory.length} Redskap valda
                </p>
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-full text-text-dim group-hover:bg-accent-blue group-hover:text-black transition-colors">
              <Edit2 size={18} />
            </div>
          </div>
        ))}

        {zones.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <Trees size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Inga platser tillagda</p>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingZone && (
        <LocationEditor 
          zone={editingZone} 
          onClose={() => setEditingZone(null)} 
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

// --- SUB-KOMPONENT: EDITORN ---

interface LocationEditorProps {
  zone: Zone;
  onClose: () => void;
  onSave: (z: Zone) => void;
  onDelete: (id: string) => void;
}

const PLATE_OPTIONS = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];

const LocationEditor: React.FC<LocationEditorProps> = ({ zone, onClose, onSave, onDelete }) => {
  const [localZone, setLocalZone] = useState<Zone>(zone);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const toggleEquipment = (eq: Equipment) => {
    const hasIt = localZone.inventory.includes(eq);
    let newInv = [];
    if (hasIt) {
      newInv = localZone.inventory.filter(i => i !== eq);
    } else {
      newInv = [...localZone.inventory, eq];
    }
    setLocalZone({ ...localZone, inventory: newInv });
  };

  const applyPreset = (type: 'gym' | 'home' | 'body') => {
    let newInv: Equipment[] = [];
    if (type === 'gym') {
      newInv = Object.values(Equipment).filter(e => e !== Equipment.TRX && e !== Equipment.BANDS); 
    } else if (type === 'home') {
      newInv = [
        Equipment.DUMBBELL, Equipment.KETTLEBELL, Equipment.BANDS, 
        Equipment.BODYWEIGHT, Equipment.PULLUP_BAR, Equipment.BENCH
      ];
    } else {
      newInv = [Equipment.BODYWEIGHT];
    }
    setLocalZone({ ...localZone, inventory: newInv });
  };
  
    const getIconForEditor = (zone: Zone) => {
        if (zone.name.toLowerCase().includes('hem')) return <Home />;
        if (zone.name.toLowerCase().includes('gym')) return <Building2 />;
        return <Dumbbell />;
    }

  return (
    <div className="fixed inset-0 bg-[#0f0d15] z-[200] flex flex-col animate-in slide-in-from-bottom-10">
      <div className="p-6 pb-2 pt-[calc(env(safe-area-inset-top)+1.5rem)] border-b border-white/10 bg-[#0f0d15] flex justify-between items-center">
        <h3 className="text-2xl font-black italic uppercase text-white">Redigera Plats</h3>
        <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X size={24}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 overscroll-contain">
        
        {/* NAMN INPUT */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">Namn & Ikon</label>
          <div className="flex gap-2">
             <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                {getIconForEditor(localZone)}
             </div>
             <input 
               type="text" 
               value={localZone.name}
               onChange={e => setLocalZone({...localZone, name: e.target.value})}
               placeholder="T.ex. Nordic Wellness"
               className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-xl font-bold text-white outline-none focus:border-accent-pink"
             />
          </div>
        </div>

        {/* PLATES SELECTOR */}
        <div className="space-y-3">
          <label className="text-sm font-black uppercase italic text-white flex items-center gap-2">
            <Scale size={18} className="text-accent-blue" /> Tillgängliga viktplattor (kg)
          </label>
          <p className="text-[10px] text-text-dim uppercase font-bold">Välj de vikter som finns på denna plats</p>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {PLATE_OPTIONS.map(plate => {
              const isSelected = localZone.availablePlates?.includes(plate);
              return (
                <button
                  key={plate}
                  onClick={() => {
                    const current = localZone.availablePlates || [];
                    const next = isSelected 
                      ? current.filter(p => p !== plate)
                      : [...current, plate].sort((a, b) => b - a);
                    setLocalZone({ ...localZone, availablePlates: next });
                  }}
                  className={`px-4 py-2 rounded-xl border font-black transition-all ${
                    isSelected 
                      ? 'bg-accent-blue border-accent-blue text-white shadow-lg' 
                      : 'bg-white/5 border-white/10 text-text-dim hover:border-white/20'
                  }`}
                >
                  {plate}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* SNABBVAL */}
        <div className="space-y-2">
           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">Snabbval</label>
           <div className="flex gap-2">
             <button onClick={() => applyPreset('gym')} className="flex-1 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all">Fullt Gym</button>
             <button onClick={() => applyPreset('home')} className="flex-1 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all">Hemma</button>
             <button onClick={() => applyPreset('body')} className="flex-1 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all">Kroppsvikt</button>
           </div>
        </div>

        {/* KATEGORISERAD UTRUSTNING */}
        <div className="space-y-8">
          {EQUIPMENT_CATEGORIES.map((category, idx) => (
            <div key={idx} className="space-y-3">
               <div className="sticky top-0 bg-[#0f0d15]/95 backdrop-blur-sm py-2 z-10 border-b border-white/5">
                 <h4 className={`text-sm font-black uppercase tracking-wider text-white`}>
                   {category.title}
                 </h4>
                 <p className="text-[10px] text-text-dim">{category.description}</p>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 {category.items.map((eq) => {
                   const isSelected = localZone.inventory.includes(eq);
                   return (
                     <button
                       key={eq}
                       onClick={() => toggleEquipment(eq)}
                       className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all active:scale-[0.98] ${
                         isSelected 
                           ? 'bg-accent-blue/10 border-accent-blue text-white shadow-[0_0_15px_rgba(46,134,213,0.15)]' 
                           : 'bg-white/5 border-white/5 text-text-dim opacity-60 hover:opacity-100'
                       }`}
                     >
                       <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-accent-blue bg-accent-blue text-black' : 'border-white/20'}`}>
                         {isSelected && <Check size={12} strokeWidth={4} />}
                       </div>
                       <span className="font-bold uppercase text-[10px] leading-tight">{eq}</span>
                     </button>
                   );
                 })}
               </div>
            </div>
          ))}
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-4 border-t border-white/10 bg-[#0f0d15] flex flex-col gap-3">
        <button 
          onClick={() => onSave(localZone)}
          disabled={!localZone.name}
          className="w-full py-5 bg-white text-black rounded-[24px] font-black italic text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
        >
          <Save size={20} /> Spara Plats
        </button>

        <button 
          onClick={() => onDelete(localZone.id)}
          className="w-full py-3 text-red-500 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors"
        >
           Radera Plats
        </button>
      </div>
    </div>
  );
};
