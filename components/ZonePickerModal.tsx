import React, { useState, useEffect } from 'react';
import { X, MapPin, AlertTriangle, CheckCircle2, Trash2, RefreshCw, ArrowRight, CheckSquare, Dumbbell, ChevronRight } from 'lucide-react';
import { Zone, Equipment, PlannedExercise, Exercise } from '../types';
import { registerBackHandler } from '../utils/backHandler';

interface ZonePickerModalProps {
  onClose: () => void;
  onSelect: (zone: Zone, filteredExercises: PlannedExercise[]) => void;
  zones: Zone[];
  plannedExercises: PlannedExercise[];
  allExercises: Exercise[];
}

export const ZonePickerModal: React.FC<ZonePickerModalProps> = ({ onClose, onSelect, zones, plannedExercises, allExercises }) => {
  
  // State for the confirmation/adjustment overlay
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    zone: Zone | null;
    incompatibleExercises: { exercise: PlannedExercise, missing: string[] }[];
  }>({
    isOpen: false,
    zone: null,
    incompatibleExercises: []
  });

  // State for selected replacements: { [originalExerciseId]: newExerciseDef }
  const [replacements, setReplacements] = useState<Record<string, Exercise>>({});
  
  // State to handle the sub-modal for picking a substitute
  const [showSubstitutesFor, setShowSubstitutesFor] = useState<string | null>(null);

  // Background scroll lock
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Android Back Handler logic
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      if (showSubstitutesFor) {
        setShowSubstitutesFor(null);
      } else if (confirmation.isOpen) {
        setConfirmation({ ...confirmation, isOpen: false });
      } else {
        onClose();
      }
    });
    return unregister;
  }, [onClose, confirmation.isOpen, showSubstitutesFor]);

  // Identify exercises that cannot be performed at a specific zone
  const getIncompatibleExercises = (zone: Zone) => {
    const incompatible: { exercise: PlannedExercise, missing: string[] }[] = [];

    plannedExercises.forEach(pe => {
      const exerciseDef = allExercises.find(e => e.id === pe.exerciseId);
      if (!exerciseDef) return;

      const missingForThis: string[] = [];

      // Logic check for equipment
      if (exerciseDef.equipmentRequirements && exerciseDef.equipmentRequirements.length > 0) {
        const satisfiesAllGroups = exerciseDef.equipmentRequirements.every(group => 
          group.some(item => zone.inventory.includes(item))
        );
        if (!satisfiesAllGroups) {
          missingForThis.push(exerciseDef.equipment[0] || 'Utrustning');
        }
      } else if (exerciseDef.equipment && exerciseDef.equipment.length > 0) {
        exerciseDef.equipment.forEach(eq => {
          if (eq !== Equipment.BODYWEIGHT && !zone.inventory.includes(eq)) {
            missingForThis.push(eq);
          }
        });
      }

      if (missingForThis.length > 0) {
          incompatible.push({ exercise: pe, missing: Array.from(new Set(missingForThis)) });
      }
    });
    return incompatible;
  };

  // Find substitutes: Same primary muscles + Equipment available in the zone
  const getSubstitutes = (originalId: string, zone: Zone): Exercise[] => {
    const original = allExercises.find(e => e.id === originalId);
    if (!original) return [];

    return allExercises.filter(e => {
        if (e.id === original.id) return false;
        
        // Match primary muscles
        const sharedMuscles = e.primaryMuscles.some(m => original.primaryMuscles.includes(m));
        if (!sharedMuscles) return false;

        // Check availability in zone
        if (e.equipmentRequirements && e.equipmentRequirements.length > 0) {
            return e.equipmentRequirements.every(group => 
                group.some(item => zone.inventory.includes(item))
            );
        }
        return e.equipment.every(eq => eq === Equipment.BODYWEIGHT || zone.inventory.includes(eq));
    }).sort((a, b) => (b.score || 5) - (a.score || 5));
  };

  const handleZoneClick = (zone: Zone) => {
    const incompatible = getIncompatibleExercises(zone);

    if (incompatible.length === 0) {
        onSelect(zone, plannedExercises);
    } else {
        setReplacements({}); // Reset selections
        setConfirmation({
            isOpen: true,
            zone,
            incompatibleExercises: incompatible
        });
    }
  };

  const confirmSelection = () => {
    if (!confirmation.zone) return;

    const finalExercises: PlannedExercise[] = [];

    plannedExercises.forEach(pe => {
        const isProblematic = confirmation.incompatibleExercises.find(i => i.exercise.exerciseId === pe.exerciseId);
        
        if (!isProblematic) {
            finalExercises.push(pe);
        } else {
            const replacement = replacements[pe.exerciseId];
            if (replacement) {
                finalExercises.push({
                    ...pe,
                    exerciseId: replacement.id,
                    notes: `Ersatte ${allExercises.find(e => e.id === pe.exerciseId)?.name}. ${pe.notes || ''}`
                });
            }
            // If no replacement is chosen, it is effectively removed (filtered out)
        }
    });

    if (finalExercises.length === 0) {
        alert("Inga övningar kvar i passet efter anpassning.");
        return;
    }

    onSelect(confirmation.zone, finalExercises);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0f0d15]/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      
      {/* --- STEP 1: PICK GYM --- */}
      <div 
        className={`bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300 ${confirmation.isOpen ? 'scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Välj Gym</h3>
            <p className="text-[10px] text-text-dim font-black uppercase tracking-widest mt-1">Var tränar du idag?</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 scrollbar-hide flex-1 overscroll-contain">
          {zones.length === 0 ? (
            <div className="text-center py-12 text-text-dim space-y-4">
                <MapPin size={48} className="mx-auto opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                  Inga gym inlagda.<br/>Gå till "Platser" för att skapa en zon.
                </p>
            </div>
          ) : (
            zones.map(zone => {
              const incompatibleCount = getIncompatibleExercises(zone).length;
              const isCompatible = incompatibleCount === 0;

              return (
                <button 
                  key={zone.id}
                  onClick={() => handleZoneClick(zone)}
                  className={`w-full text-left p-5 rounded-[32px] border transition-all relative group active:scale-[0.98] ${
                    isCompatible 
                      ? 'bg-white/5 border-white/10 hover:border-green-500/50' 
                      : 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isCompatible ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                            <MapPin size={24} />
                        </div>
                        <div>
                            <span className={`text-lg font-black italic uppercase block leading-none mb-1 ${isCompatible ? 'text-white' : 'text-yellow-500'}`}>
                                {zone.name}
                            </span>
                            <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">
                                {zone.inventory.length} redskap
                            </span>
                        </div>
                    </div>
                    {isCompatible ? <CheckCircle2 size={20} className="text-green-500" /> : <AlertTriangle size={20} className="text-yellow-500" />}
                  </div>
                  {!isCompatible && (
                      <div className="mt-4 text-[10px] text-yellow-500/80 bg-yellow-500/10 p-3 rounded-2xl border border-yellow-500/10">
                          <span className="font-black uppercase tracking-widest block mb-1">Anpassning Krävs</span>
                          {incompatibleCount} övningar saknar utrustning här.
                      </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- STEP 2: ADJUST SESSION OVERLAY --- */}
      {confirmation.isOpen && confirmation.zone && (
        <div className="absolute inset-0 z-[210] flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
            <div className="bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                
                <div className="p-8 border-b border-white/5 bg-yellow-500/5">
                    <div className="flex items-center gap-3 text-yellow-500 mb-2">
                        <AlertTriangle size={24} />
                        <h3 className="text-xl font-black italic uppercase text-white">Anpassa Passet</h3>
                    </div>
                    <p className="text-[10px] text-text-dim font-black uppercase tracking-widest">
                        Plats: <span className="text-white">{confirmation.zone.name}</span>
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide overscroll-contain">
                    <p className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em] mb-4">Översikt & Ersättningar</p>
                    
                    {plannedExercises.map((pe, idx) => {
                        const originalEx = allExercises.find(e => e.id === pe.exerciseId);
                        const problem = confirmation.incompatibleExercises.find(i => i.exercise.exerciseId === pe.exerciseId);
                        const replacement = replacements[pe.exerciseId];

                        if (!problem) {
                            return (
                                <div key={idx} className="flex items-center gap-4 p-4 rounded-[24px] bg-green-500/5 border border-green-500/10 opacity-60">
                                    <CheckSquare size={20} className="text-green-500 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="text-xs font-black italic uppercase text-white truncate block">{originalEx?.name}</span>
                                        <span className="text-[8px] font-black uppercase text-green-500 tracking-widest">Ok • Redskap finns</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={idx} className={`p-4 rounded-[24px] border animate-in slide-in-from-left-2 transition-all ${replacement ? 'bg-accent-blue/5 border-accent-blue/30' : 'bg-red-500/5 border-red-500/20'}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {replacement ? <RefreshCw size={18} className="text-accent-blue shrink-0"/> : <Trash2 size={18} className="text-red-500 shrink-0"/>}
                                        <div className="min-w-0">
                                            <span className={`text-xs font-black italic uppercase block truncate ${replacement ? 'text-white' : 'text-red-400 line-through'}`}>
                                                {originalEx?.name}
                                            </span>
                                            {!replacement && (
                                                <span className="text-[8px] font-black uppercase text-red-500/60 tracking-widest">Saknar: {problem.missing.join(', ')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {replacement && (
                                    <div className="flex items-center gap-3 p-3 bg-accent-blue/10 rounded-xl mb-3 border border-accent-blue/10">
                                        <ArrowRight size={14} className="text-accent-blue"/>
                                        <div>
                                            <span className="text-[8px] font-black uppercase text-accent-blue block tracking-widest mb-0.5">NY ÖVNING</span>
                                            <span className="text-xs font-bold text-white">{replacement.name}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setShowSubstitutesFor(pe.exerciseId)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        <RefreshCw size={12}/> {replacement ? 'Ändra' : 'Hitta Ersättare'}
                                    </button>
                                    {replacement && (
                                        <button 
                                            onClick={() => {
                                                const next = {...replacements};
                                                delete next[pe.exerciseId];
                                                setReplacements(next);
                                            }}
                                            className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-all"
                                        >
                                            <X size={16}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-8 border-t border-white/5 bg-black/20 flex flex-col gap-3">
                    <button 
                        onClick={confirmSelection}
                        className="w-full py-5 bg-green-500 hover:bg-green-400 text-white rounded-3xl font-black italic uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        Bygg & Starta Pass
                    </button>
                    <button 
                        onClick={() => setConfirmation({ ...confirmation, isOpen: false })}
                        className="w-full py-3 text-text-dim hover:text-white font-black uppercase tracking-widest text-[10px] transition-colors"
                    >
                        Byt gym
                    </button>
                </div>

                {/* --- SUB-VIEW: SELECT SUBSTITUTE --- */}
                {showSubstitutesFor && confirmation.zone && (
                    <div className="absolute inset-0 bg-[#0f0d15] z-[220] flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="p-8 border-b border-white/5 flex items-center gap-4 bg-[#1a1721] shrink-0">
                            <button onClick={() => setShowSubstitutesFor(null)} className="p-3 bg-white/5 rounded-2xl active:scale-90"><X size={20}/></button>
                            <div>
                                <p className="text-[9px] font-black text-accent-blue uppercase tracking-widest mb-1">Välj Ersättare för</p>
                                <h4 className="text-lg font-black italic uppercase text-white truncate">
                                    {allExercises.find(e => e.id === showSubstitutesFor)?.name}
                                </h4>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide overscroll-contain">
                            {(() => {
                                const subs = getSubstitutes(showSubstitutesFor, confirmation.zone);
                                if (subs.length === 0) {
                                    return (
                                        <div className="py-20 text-center space-y-4 opacity-30">
                                            <Dumbbell size={48} className="mx-auto" />
                                            <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
                                                Inga liknande övningar<br/>hittades med tillgänglig utrustning.
                                            </p>
                                        </div>
                                    );
                                }
                                return subs.map(sub => (
                                    <button 
                                        key={sub.id} 
                                        onClick={() => {
                                            setReplacements(prev => ({...prev, [showSubstitutesFor]: sub}));
                                            setShowSubstitutesFor(null);
                                        }}
                                        className="w-full text-left p-5 rounded-[28px] bg-[#1a1721] border border-white/5 hover:border-accent-blue/50 flex justify-between items-center group transition-all active:scale-[0.98]"
                                    >
                                        <div className="min-w-0 pr-4">
                                            <span className="text-sm font-black italic uppercase text-white block truncate group-hover:text-accent-blue transition-colors">{sub.name}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[8px] font-black uppercase text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded tracking-widest">{sub.equipment[0]}</span>
                                                <span className="text-[8px] font-black uppercase text-text-dim tracking-widest">{sub.primaryMuscles[0]}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-text-dim group-hover:text-white" />
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

    </div>
  );
};