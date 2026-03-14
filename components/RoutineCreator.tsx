
import React, { useState, useEffect } from 'react';
import { Exercise, WorkoutRoutine, PlannedExercise, WorkoutSet, WorkoutSession } from '../types';
import { ExerciseLibrary } from './ExerciseLibrary';
import { Save, Plus, Trash2, X } from 'lucide-react';

interface RoutineCreatorProps {
  allExercises: Exercise[];
  history: WorkoutSession[];
  onSave: (routine: WorkoutRoutine) => void;
  onCancel: () => void;
  initialRoutine?: Partial<WorkoutRoutine>;
}

export const RoutineCreator: React.FC<RoutineCreatorProps> = ({ 
  allExercises, history, onSave, onCancel, initialRoutine 
}) => {
  const [routineName, setRoutineName] = useState(initialRoutine?.name || '');
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>(initialRoutine?.exercises || []);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleAddExercise = (ex: Exercise) => {
    const newPlanned: PlannedExercise = {
      exerciseId: ex.id,
      sets: [
        { reps: 10, weight: 0, completed: false, type: 'normal' },
        { reps: 10, weight: 0, completed: false, type: 'normal' },
        { reps: 10, weight: 0, completed: false, type: 'normal' }
      ],
      notes: ''
    };
    setPlannedExercises([...plannedExercises, newPlanned]);
    setShowLibrary(false);
  };

  const updateSet = (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: number) => {
    const updatedExs = [...plannedExercises];
    const updatedSets = [...updatedExs[exIdx].sets];
    updatedSets[setIdx] = { ...updatedSets[setIdx], [field]: value };
    updatedExs[exIdx] = { ...updatedExs[exIdx], sets: updatedSets };
    setPlannedExercises(updatedExs);
  };

  const addSet = (exIdx: number) => {
    const updatedExs = [...plannedExercises];
    const lastSet = updatedExs[exIdx].sets[updatedExs[exIdx].sets.length - 1];
    updatedExs[exIdx].sets.push({ ...lastSet, completed: false });
    setPlannedExercises(updatedExs);
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    const updatedExs = [...plannedExercises];
    if (updatedExs[exIdx].sets.length > 1) {
      updatedExs[exIdx].sets.splice(setIdx, 1);
      setPlannedExercises(updatedExs);
    }
  };

  const removeExercise = (exIdx: number) => {
    const updatedExs = [...plannedExercises];
    updatedExs.splice(exIdx, 1);
    setPlannedExercises(updatedExs);
  };

  const handleSave = () => {
    if (!routineName) return alert("Ange ett namn på rutinen");
    if (plannedExercises.length === 0) return alert("Lägg till minst en övning");

    const newRoutine: WorkoutRoutine = {
      id: initialRoutine?.id || `routine-${Date.now()}`,
      name: routineName,
      exercises: plannedExercises,
      category: 'Egen'
    };
    onSave(newRoutine);
  };

  if (showLibrary) {
    return (
      <div className="fixed inset-0 z-[300] bg-[#0f0d15]">
        <ExerciseLibrary 
          allExercises={allExercises} 
          history={history}
          onSelect={handleAddExercise} 
          onClose={() => setShowLibrary(false)}
          onUpdate={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] bg-[#0f0d15] flex flex-col animate-in slide-in-from-bottom-10 overscroll-y-contain">
      <div className="p-4 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-white/10 flex justify-between items-center bg-[#1a1721] sticky top-0 z-10">
        <div>
          <h3 className="text-xl font-black italic uppercase text-white">{initialRoutine?.id ? 'Redigera' : 'Skapa'} Rutin</h3>
          <p className="text-[10px] text-text-dim uppercase tracking-widest">Designa ditt pass</p>
        </div>
        <button onClick={onCancel} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide overscroll-contain">
        <div>
          <label className="text-xs font-bold text-text-dim uppercase mb-2 block">Rutinens Namn</label>
          <input 
            type="text" 
            placeholder="T.ex. Push - Tungt" 
            value={routineName}
            onChange={e => setRoutineName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold outline-none focus:border-accent-pink"
          />
        </div>

        <div className="space-y-4">
          {plannedExercises.map((item, exIdx) => {
            const exData = allExercises.find(e => e.id === item.exerciseId);
            if (!exData) return null;

            return (
              <div key={`${item.exerciseId}-${exIdx}`} className="bg-[#1a1721] border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h4 className="text-lg font-black italic uppercase text-white truncate">{exData.name}</h4>
                    {exData.englishName && <p className="text-xs text-white/40 italic truncate">{exData.englishName}</p>}
                  </div>
                  <button onClick={() => removeExercise(exIdx)} className="text-text-dim hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-10 gap-2 text-[9px] font-black uppercase text-text-dim mb-1 px-2">
                    <span className="col-span-1 text-center">Set</span>
                    <span className="col-span-4 text-center">KG</span>
                    <span className="col-span-4 text-center">Reps</span>
                    <span className="col-span-1"></span>
                  </div>
                  {item.sets.map((set, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-10 gap-2 items-center">
                      <div className="col-span-1 flex justify-center"><span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-text-dim">{setIdx + 1}</span></div>
                      <div className="col-span-4"><input type="number" onFocus={(e) => e.target.select()} value={set.weight || ''} onChange={(e) => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-bold text-sm outline-none focus:border-accent-blue" /></div>
                      <div className="col-span-4"><input type="number" onFocus={(e) => e.target.select()} value={set.reps || ''} onChange={(e) => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-bold text-sm outline-none focus:border-accent-blue" /></div>
                      <div className="col-span-1 flex justify-center"><button onClick={() => removeSet(exIdx, setIdx)} className="text-white/20 hover:text-red-500"><X size={14} /></button></div>
                    </div>
                  ))}
                </div>
                <button onClick={() => addSet(exIdx)} className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-text-dim uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14} /> Lägg till Set</button>
              </div>
            );
          })}
        </div>
        <button onClick={() => setShowLibrary(true)} className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2 text-text-dim hover:text-white hover:border-white/30 transition-all"><Plus size={20} /> <span className="font-bold uppercase tracking-widest text-xs">Lägg till övning</span></button>
      </div>
      <div className="p-4 bg-[#1a1721] border-t border-white/10 sticky bottom-0">
        <button onClick={handleSave} className="w-full py-4 bg-accent-blue text-white rounded-2xl font-black italic uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 shadow-lg"><Save size={20} /> Spara Rutin</button>
      </div>
    </div>
  );
};
