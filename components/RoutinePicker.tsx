
import React, { useMemo, useState, useEffect } from 'react';
import { WorkoutRoutine, Zone, Exercise, PlannedExercise, MovementPattern, MuscleGroup, Equipment, UserProfile, WorkoutSession } from '../types';
import { storage } from '../services/storage';
import { findReplacement, adaptVolume } from '../utils/fitness';
import { RoutineCreator } from './RoutineCreator';
import { Plus, Play, ChevronRight, Bookmark, Trash2, Dumbbell, Edit3, X, Check, Search, Filter, Sparkles, Loader2 } from 'lucide-react';
import { registerBackHandler } from '../utils/backHandler';
import { generateWorkoutFromPrompt } from '../services/geminiService';


interface RoutinePickerProps {
  onStart: (exercises: PlannedExercise[], routineName: string) => void;
  activeZone: Zone;
  routines: WorkoutRoutine[];
  allExercises: Exercise[];
  userProfile: UserProfile;
  onUpdate: () => void;
  history: WorkoutSession[];
}

export const RoutinePicker: React.FC<RoutinePickerProps> = ({ onStart, activeZone, routines, allExercises, userProfile, onUpdate, history }) => {
  const [showAIScout, setShowAIScout] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Partial<WorkoutRoutine> | null>(null);

  // Hantera Android Back
  useEffect(() => {
    if (showAIScout) return registerBackHandler(() => setShowAIScout(false));
    if (editingRoutine) return registerBackHandler(() => setEditingRoutine(null));
  }, [showAIScout, editingRoutine]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const workout = await generateWorkoutFromPrompt(prompt, allExercises, activeZone, history);
      onStart(workout, `AI Scout: ${prompt}`);
    } catch (e) {
      alert("Kunde inte generera pass. Försök igen.");
    } finally {
      setIsGenerating(false);
    }
  };


  const handleSelectRoutine = (routine: WorkoutRoutine) => {
    const morphedExercises = routine.exercises.map(pe => {
      const originalEx = allExercises.find(ex => ex.id === pe.exerciseId);
      if (!originalEx) return { ...pe, sets: pe.sets.map(s => ({ ...s, completed: false })) };
      
      const isAvailable = originalEx.equipment.every(eq => activeZone.inventory.includes(eq));
      if (!isAvailable) {
        const replacement = findReplacement(originalEx, activeZone, allExercises);
        const newSets = adaptVolume(pe.sets, originalEx, replacement, userProfile.goal);
        return { ...pe, exerciseId: replacement.id, sets: newSets.map(s => ({ ...s, completed: false })) };
      }
      return { ...pe, sets: pe.sets.map(s => ({ ...s, completed: false })) };
    });
    onStart(morphedExercises, routine.name);
  };

  const saveRoutine = async (routineToSave: WorkoutRoutine) => {
    await storage.saveRoutine(routineToSave);
    onUpdate();
    setEditingRoutine(null);
  };

  const deleteRoutine = async (id: string) => {
    if (confirm("Ta bort rutin?")) { 
      await storage.deleteRoutine(id); 
      onUpdate(); 
    }
  };

  if (editingRoutine) {
    return (
      <RoutineCreator 
        allExercises={allExercises}
        initialRoutine={editingRoutine}
        onSave={saveRoutine}
        onCancel={() => setEditingRoutine(null)}
        history={history}
      />
    );
  }
  
  if (showAIScout) {
    return (
      <div className="animate-in slide-in-from-right duration-300 h-full flex flex-col">
        <header className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-black italic uppercase">AI Scout</h3>
          <button onClick={() => setShowAIScout(false)} className="p-2"><X /></button>
        </header>
        <div className="bg-white/5 p-6 rounded-[32px] border border-white/10 mb-4">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Vad vill du träna? T.ex. Ett pass för bröst och triceps..."
            className="w-full bg-transparent border-none focus:ring-0 text-white min-h-[100px]"
          />
        </div>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt}
          className="w-full py-5 bg-green-600 text-white rounded-3xl font-black uppercase italic flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-900/20"
        >
          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Generera & Starta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      
      {/* 1. FRI TRÄNING - NU MED STOR DESIGN */}
      <button 
        onClick={() => onStart([], "Fri Träning")}
        className="w-full bg-accent-blue/10 border border-accent-blue/30 p-8 rounded-[40px] flex items-center justify-between group active:scale-95 transition-all shadow-lg"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent-blue/20 rounded-[24px] flex items-center justify-center text-accent-blue">
            <Dumbbell size={32} />
          </div>
          <div className="text-left">
            <span className="text-2xl font-black uppercase italic tracking-tight text-white block">Fri Träning</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-accent-blue/80">Logga pass fritt</span>
          </div>
        </div>
        <ChevronRight size={32} className="text-accent-blue" />
      </button>

      {/* 2. AI SCOUT - NU MED STANDARD DESIGN */}
      <button 
        onClick={() => setShowAIScout(true)}
        className="w-full bg-white/5 border border-white/10 p-6 rounded-[32px] flex items-center justify-between active:scale-95 transition-all group hover:bg-white/10"
      >
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-accent-blue/20 group-hover:text-accent-blue transition-colors">
            <Sparkles size={24} />
          </div>
          <div className="text-left">
            <h4 className="text-lg font-black uppercase italic leading-none">AI Scout</h4>
            <p className="text-[10px] font-black text-text-dim uppercase mt-1">Generera pass</p>
          </div>
        </div>
        <ChevronRight size={24} className="text-text-dim group-hover:text-white transition-colors" />
      </button>

      {/* 3. SKAPA NY RUTIN */}
      <button 
        onClick={() => setEditingRoutine({})}
        className="w-full bg-white/5 border border-white/10 p-6 rounded-[32px] flex items-center justify-between active:scale-95 transition-all group hover:bg-white/10"
      >
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-accent-green/20 group-hover:text-accent-green transition-colors">
            <Plus size={24} />
          </div>
          <div className="text-left">
            <h4 className="text-lg font-black uppercase italic leading-none">Skapa Rutin</h4>
            <p className="text-[10px] font-black text-text-dim uppercase mt-1">Designa eget pass</p>
          </div>
        </div>
        <ChevronRight size={24} className="text-text-dim group-hover:text-white transition-colors" />
      </button>

      {routines.length > 0 && <div className="h-px bg-white/10 my-4" />}

      {routines.map(routine => (
          <div key={routine.id} className="relative group flex gap-2">
            <button onClick={() => handleSelectRoutine(routine)} className="flex-1 bg-white/5 border border-white/10 p-6 rounded-[32px] flex items-center justify-between active:scale-95 transition-all hover:bg-white/10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center"><Bookmark size={24} className="text-white/40" /></div>
                <div className="text-left"><h4 className="text-lg font-black uppercase italic leading-none truncate max-w-[150px]">{routine.name}</h4><p className="text-[10px] font-black text-text-dim uppercase mt-1 tracking-widest">{routine.exercises.length} övningar</p></div>
              </div>
              <Play size={20} className="text-white/40 group-hover:text-accent-pink" />
            </button>
            <div className="flex flex-col gap-2">
              <button onClick={() => setEditingRoutine(routine)} className="p-4 bg-white/5 rounded-2xl text-text-dim hover:text-white hover:bg-white/10 transition-colors"><Edit3 size={18} /></button>
              <button onClick={() => deleteRoutine(routine.id)} className="p-4 bg-white/5 rounded-2xl text-text-dim hover:text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
    </div>
  );
};
