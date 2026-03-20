import React, { useState, useEffect } from 'react';
import { MuscleGroup, Zone, Exercise, UserProfile, WorkoutSession, PlannedExercise, MovementPattern, Equipment } from '../types';
import { ALL_MUSCLE_GROUPS } from '../utils/recovery';
import { generateWorkoutSession } from '../utils/fitness';
import { rankExercisesBySmart } from '../utils/smartPTAnalysis';
import { X, Zap, Dumbbell, Layers, ArrowRight, Sparkles, Activity, Wrench } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './Toast';

interface WorkoutGeneratorProps {
  activeZone: Zone;
  allExercises: Exercise[];
  userProfile: UserProfile;
  history: WorkoutSession[];
  onGenerate: (exercises: PlannedExercise[]) => void;
  onClose: () => void;
}

const SPLITS: { name: string; label: string; muscles: MuscleGroup[] }[] = [
  { 
    name: 'Push', 
    label: 'Press', 
    muscles: ['Bröst', 'Axlar', 'Triceps'] 
  },
  { 
    name: 'Pull', 
    label: 'Drag', 
    muscles: ['Rygg', 'Biceps', 'Trapezius', 'Underarmar', 'Baksida lår'] 
  },
  { 
    name: 'Legs', 
    label: 'Ben', 
    muscles: ['Framsida lår', 'Baksida lår', 'Säte', 'Vader', 'Abduktorer', 'Adduktorer'] 
  },
  { 
    name: 'Upper', 
    label: 'Överkropp', 
    muscles: ['Bröst', 'Rygg', 'Axlar', 'Biceps', 'Triceps'] 
  },
  { 
    name: 'Lower', 
    label: 'Underkropp', 
    muscles: ['Framsida lår', 'Baksida lår', 'Säte', 'Vader'] 
  },
  { 
    name: 'Full', 
    label: 'Helkropp', 
    muscles: ALL_MUSCLE_GROUPS 
  }
];

const LOCALSTORAGE_KEY_PATTERNS = 'smartpt_selected_patterns';

export const WorkoutGenerator: React.FC<WorkoutGeneratorProps> = ({
  activeZone, allExercises, userProfile, history, onGenerate, onClose
}) => {
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [exerciseCount, setExerciseCount] = useState(6);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNoExercisesModal, setShowNoExercisesModal] = useState(false);
  const { showToast, ToastComponent } = useToast();

  // Movement Patterns - ladda från localStorage per gym
  const [selectedPatterns, setSelectedPatterns] = useState<MovementPattern[]>(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY_PATTERNS);
      if (stored) {
        const data = JSON.parse(stored);
        // Returnera sparade patterns för detta gym, annars alla patterns
        if (data[activeZone.id]) {
          return data[activeZone.id];
        }
      }
    } catch (e) {
      console.error('Failed to load patterns from localStorage:', e);
    }
    // Default: alla patterns är valda första gången
    return Object.values(MovementPattern);
  });

  // Equipment - ladda alltid från gymmet
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment[]>(activeZone.inventory || []);

  // Spara selectedPatterns till localStorage när de ändras
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_KEY_PATTERNS);
      const data = stored ? JSON.parse(stored) : {};
      data[activeZone.id] = selectedPatterns;
      localStorage.setItem(LOCALSTORAGE_KEY_PATTERNS, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save patterns to localStorage:', e);
    }
  }, [selectedPatterns, activeZone.id]);

  const toggleMuscle = (m: MuscleGroup) => {
    setSelectedMuscles(prev =>
      prev.includes(m) ? prev.filter(i => i !== m) : [...prev, m]
    );
  };

  const togglePattern = (p: MovementPattern) => {
    setSelectedPatterns(prev =>
      prev.includes(p) ? prev.filter(i => i !== p) : [...prev, p]
    );
  };

  const toggleEquipment = (e: Equipment) => {
    setSelectedEquipment(prev =>
      prev.includes(e) ? prev.filter(i => i !== e) : [...prev, e]
    );
  };

  const handleGenerate = () => {
    if (selectedMuscles.length === 0) {
      showToast("Välj minst en muskelgrupp eller split", "warning");
      return;
    }

    if (selectedPatterns.length === 0) {
      showToast("Välj minst ett rörelsemönster", "warning");
      return;
    }

    if (selectedEquipment.length === 0) {
      showToast("Välj minst en typ av utrustning", "warning");
      return;
    }

    setIsGenerating(true);

    // Kort fördröjning för att visa laddningseffekt
    setTimeout(() => {
      // 1. Filtrera övningar baserat på valda patterns och equipment
      const filteredExercises = allExercises.filter(ex => {
        // Kolla att övningen använder valda patterns
        if (!selectedPatterns.includes(ex.pattern)) {
          return false;
        }

        // Kolla att övningen använder vald equipment
        const hasSelectedEquipment = ex.equipment.some(eq => selectedEquipment.includes(eq));
        if (!hasSelectedEquipment) {
          return false;
        }

        return true;
      });

      // 2. SMART RANKING - Ranka övningar baserat på alla faktorer
      const bodyweight = userProfile.bodyweight || 80;
      const rankedExercises = rankExercisesBySmart(
        filteredExercises,
        history,
        bodyweight
      );

      // 3. Filtrera bort banned och avoid övningar
      const smartFiltered = rankedExercises
        .filter(r => r.recommendation !== 'banned' && r.recommendation !== 'avoid')
        .map(r => filteredExercises.find(ex => ex.id === r.exerciseId)!)
        .filter(Boolean);

      // 4. Sortera så highly_recommended och recommended kommer först
      const sortedExercises = smartFiltered.sort((a, b) => {
        const scoreA = rankedExercises.find(r => r.exerciseId === a.id)?.totalScore || 0;
        const scoreB = rankedExercises.find(r => r.exerciseId === b.id)?.totalScore || 0;
        return scoreB - scoreA;
      });

      // Skapa ett temporärt Zone-objekt med filtrerad inventory
      const filteredZone: Zone = {
        ...activeZone,
        inventory: selectedEquipment
      };

      // 5. Generera pass med SMARTA övningar
      const generated = generateWorkoutSession(
        selectedMuscles,
        filteredZone,
        sortedExercises, // ← Sorterad och filtrerad lista
        userProfile,
        history,
        exerciseCount
      );

      if (generated.length === 0) {
        setShowNoExercisesModal(true);
        setIsGenerating(false);
      } else {
        onGenerate(generated);
      }
    }, 400);
  };

  const isSplitActive = (splitMuscles: MuscleGroup[]) => {
    return splitMuscles.length === selectedMuscles.length && 
           splitMuscles.every(m => selectedMuscles.includes(m));
  };

  return (
    <div className="fixed inset-0 bg-[#0f0d15] z-[200] flex flex-col p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] animate-in slide-in-from-bottom-10 duration-500">
      <header className="flex justify-between items-center mb-10">
        <div>
           <h2 className="text-3xl font-black italic uppercase text-white flex items-center gap-2">
             <Sparkles className="text-accent-blue" size={28} /> Smart PT
           </h2>
           <p className="text-[10px] text-text-dim uppercase tracking-widest font-black">AI-Generator • {activeZone.name}</p>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl"><X size={28} className="text-text-dim" /></button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-10 pb-32">
        {/* 1. SNABBVAL (SPLITS) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Layers size={16} className="text-accent-pink" />
            <h3 className="text-xs font-black uppercase text-white tracking-widest">Snabbval Split</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SPLITS.map(split => (
              <button
                key={split.name}
                onClick={() => setSelectedMuscles(split.muscles)}
                className={`py-4 rounded-2xl border font-black uppercase italic text-[11px] transition-all active:scale-95 ${
                  isSplitActive(split.muscles)
                    ? 'bg-accent-blue text-white border-accent-blue shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 text-text-dim border-white/5 hover:bg-white/10'
                }`}
              >
                {split.label}
              </button>
            ))}
          </div>
        </section>

        {/* 2. ANTAL ÖVNINGAR (SLIDER) */}
        <section className="space-y-6">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <Dumbbell size={16} className="text-accent-green" />
              <h3 className="text-xs font-black uppercase text-white tracking-widest">Antal Övningar</h3>
            </div>
            <span className="text-2xl font-black italic text-white leading-none">{exerciseCount}</span>
          </div>
          
          <div className="px-2">
            <input 
              type="range" 
              min="1" max="12" step="1"
              value={exerciseCount}
              onChange={(e) => setExerciseCount(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-green"
            />
            <div className="flex justify-between text-[8px] font-black text-text-dim uppercase mt-3 tracking-widest">
              <span>Express</span>
              <span>Standard</span>
              <span>Maraton</span>
            </div>
          </div>
        </section>

        {/* 3. RÖRELSEMÖNSTER (MOVEMENT PATTERNS) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Activity size={16} className="text-purple-500" />
            <h3 className="text-xs font-black uppercase text-white tracking-widest">Rörelsemönster ({selectedPatterns.length}/{Object.values(MovementPattern).length})</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(MovementPattern).map(p => (
              <button
                key={p}
                onClick={() => togglePattern(p)}
                className={`p-3 rounded-xl border text-left transition-all text-[10px] font-bold uppercase ${
                  selectedPatterns.includes(p)
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : 'bg-white/5 text-text-dim border-transparent hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* 4. UTRUSTNING (EQUIPMENT) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Wrench size={16} className="text-orange-500" />
            <h3 className="text-xs font-black uppercase text-white tracking-widest">Utrustning ({selectedEquipment.length}/{activeZone.inventory?.length || 0})</h3>
          </div>
          <p className="text-[9px] text-text-dim uppercase font-bold px-1">Gröna = Tillgängliga på {activeZone.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {activeZone.inventory?.map(eq => (
              <button
                key={eq}
                onClick={() => toggleEquipment(eq)}
                className={`p-3 rounded-xl border text-left transition-all text-[10px] font-bold uppercase ${
                  selectedEquipment.includes(eq)
                    ? 'bg-green-500/20 text-green-300 border-green-500/50'
                    : 'bg-white/5 text-text-dim border-transparent hover:bg-white/10'
                }`}
              >
                {eq}
              </button>
            ))}
          </div>
        </section>

        {/* 5. MUSKELGRUPPER (LISTA) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Zap size={16} className="text-yellow-500" />
            <h3 className="text-xs font-black uppercase text-white tracking-widest">Anpassat val ({selectedMuscles.length})</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MUSCLE_GROUPS.map(m => (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={`p-4 rounded-xl border text-left transition-all text-[10px] font-bold uppercase ${
                  selectedMuscles.includes(m)
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-text-dim border-transparent hover:bg-white/5'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[#0f0d15]/80 backdrop-blur-xl border-t border-white/5 pb-safe">
         <button
           disabled={isGenerating || selectedMuscles.length === 0}
           onClick={handleGenerate}
           className="w-full py-5 bg-white text-black rounded-[32px] font-black italic text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
         >
           {isGenerating ? (
             <>Tänker... <Dumbbell className="animate-spin" size={24} /></>
           ) : (
             <>Bygg Passet <ArrowRight size={24} strokeWidth={3} /></>
           )}
         </button>
      </div>

      {ToastComponent}

      {showNoExercisesModal && (
        <ConfirmModal
          title="Inga övningar hittades"
          message={`Kunde inte hitta några övningar i "${activeZone.name}" för de valda musklerna. Kontrollera att gymmet har rätt utrustning eller välj andra muskelgrupper.`}
          confirmLabel="OK"
          onConfirm={() => setShowNoExercisesModal(false)}
          onCancel={() => setShowNoExercisesModal(false)}
        />
      )}
    </div>
  );
};