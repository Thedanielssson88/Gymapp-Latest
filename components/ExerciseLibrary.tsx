
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Exercise, MovementPattern, Equipment, MuscleGroup, ExerciseTier, TrackingType, Zone, WorkoutSession, UserProfile } from '../types';
import { storage } from '../services/storage';
import { ALL_MUSCLE_GROUPS } from '../utils/recovery';
import { AIExerciseRecommender } from './AIExerciseRecommender';
import { ImageUpload } from './ImageUpload';
import { useExerciseImage } from '../hooks/useExerciseImage';
import { generateExerciseDetailsFromGemini } from '../services/geminiService';
import { calculate1RM } from '../utils/fitness';
import { EquipmentBuilder } from './EquipmentBuilder';
import { registerBackHandler } from '../utils/backHandler';
import { Plus, Search, Edit3, Trash2, X, Dumbbell, Save, Activity, Layers, Scale, Link as LinkIcon, Check, ArrowRightLeft, Filter, ChevronDown, Zap, Loader2, TrendingUp, Trophy, Clock, SortAsc, ChevronRight, ThumbsUp, ThumbsDown, Heart, Sparkles } from 'lucide-react';

interface ExerciseLibraryProps {
  allExercises: Exercise[];
  history: WorkoutSession[];
  onUpdate: () => void;
  onSelect?: (exercise: Exercise) => void;
  onClose?: () => void;
  activeZone?: Zone;
  userProfile?: UserProfile;
  initialExerciseId?: string | null;
}

const ITEMS_PER_PAGE = 20;

const ExerciseImage = ({ exercise }: { exercise: Exercise }) => {
    const imageSrc = useExerciseImage(exercise);
    return (
        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
            {imageSrc ? (
                <img src={imageSrc} alt={exercise.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
                <Dumbbell className="text-white/20" size={20} />
            )}
        </div>
    );
};

export const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ allExercises: initialExercises, history, onUpdate, onSelect, onClose, activeZone, userProfile, initialExerciseId }) => {
  const [exercises, setExercises] = useState(initialExercises || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'recent'>('recent');
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [showAIScout, setShowAIScout] = useState(false);
  const isSelectorMode = !!onSelect;
  const listRef = useRef<HTMLDivElement>(null);

  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'muscles' | 'equipment' | 'pattern'>('all');
  const [selectedFilterValue, setSelectedFilterValue] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    if (initialExerciseId) {
      const ex = initialExercises.find(e => e.id === initialExerciseId);
      if (ex) {
        setEditingExercise(ex);
      }
    }
  }, [initialExerciseId, initialExercises]);

  useEffect(() => {
    if (editingExercise) return registerBackHandler(() => setEditingExercise(null));
  }, [editingExercise]);
  
  useEffect(() => {
    if (showAIScout) return registerBackHandler(() => setShowAIScout(false));
  }, [showAIScout]);

  useEffect(() => {
    if (initialExercises.length !== exercises.length) {
      setExercises(initialExercises);
    } else {
       const initialIds = initialExercises.map(e => e.id).join(',');
       const currentIds = exercises.map(e => e.id).join(',');
       if(initialIds !== currentIds) {
          setExercises(initialExercises);
       }
    }
  }, [initialExercises]);

  useEffect(() => {
    const isModalOpen = isSelectorMode || !!editingExercise || showAIScout;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isSelectorMode, editingExercise, showAIScout]);

  const handleRate = async (ex: Exercise, rating: 'up' | 'down') => {
    const newRating = ex.userRating === rating ? null : rating;
    let newScore = 5;
    if (newRating === 'up') newScore = 10;
    if (newRating === 'down') newScore = 1;
    const updatedExercise = { ...ex, userRating: newRating, score: newScore };
    setExercises(prev => prev.map(exercise => exercise.id === ex.id ? updatedExercise : exercise));
    try {
      await storage.updateExercise(ex.id, { userRating: newRating, score: newScore });
    } catch (error) {
      setExercises(prev => prev.map(exercise => exercise.id === ex.id ? ex : exercise));
      alert("Kunde inte spara betyget.");
    }
  };
  
  const getLastUsed = (exerciseId: string) => {
    const usage = (history || [])
      .filter(s => s.exercises && s.exercises.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return usage.length > 0 ? new Date(usage[0].date).getTime() : 0;
  };

  const filteredExercises = useMemo(() => {
    let filtered = (exercises || []).filter(ex => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = ex.name.toLowerCase().includes(q) || ex.englishName?.toLowerCase().includes(q);
      if (showOnlyFavorites && ex.userRating !== 'up') return false;
      let matchesFilter = true;
      if (selectedFilterValue) {
          if (activeFilterTab === 'muscles') matchesFilter = ex.primaryMuscles?.includes(selectedFilterValue as MuscleGroup) || ex.muscleGroups?.includes(selectedFilterValue as MuscleGroup);
          else if (activeFilterTab === 'equipment') matchesFilter = ex.equipment?.includes(selectedFilterValue as Equipment);
          else if (activeFilterTab === 'pattern') matchesFilter = ex.pattern === selectedFilterValue;
      }
      if (isSelectorMode && activeZone) {
          const hasRequiredEquipment = (ex: Exercise, zoneInventory: Equipment[]): boolean => {
            if (!ex.equipmentRequirements || ex.equipmentRequirements.length === 0) return ex.equipment.every(eq => zoneInventory.includes(eq));
            return ex.equipmentRequirements.every(group => group.some(item => zoneInventory.includes(item)));
          };
          if (!hasRequiredEquipment(ex, activeZone.inventory)) return false;
      }
      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = getLastUsed(a.id);
        const timeB = getLastUsed(b.id);
        if (timeA !== timeB) return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [exercises, searchQuery, activeFilterTab, selectedFilterValue, isSelectorMode, activeZone, sortBy, history, showOnlyFavorites]);

  useEffect(() => {
      setDisplayCount(ITEMS_PER_PAGE);
      if (listRef.current) listRef.current.scrollTop = 0;
  }, [searchQuery, activeFilterTab, selectedFilterValue, sortBy, showOnlyFavorites]);

  const visibleExercises = filteredExercises.slice(0, displayCount);

  const handleSave = async (exerciseData: Exercise) => {
    try {
        const exerciseToSave = { 
            ...exerciseData, 
            muscleGroups: Array.from(new Set([...(exerciseData.primaryMuscles || []), ...(exerciseData.secondaryMuscles || [])])) 
        };
        setExercises(prev => {
            const exists = prev.some(ex => ex.id === exerciseToSave.id);
            if (exists) return prev.map(ex => ex.id === exerciseToSave.id ? exerciseToSave : ex);
            return [exerciseToSave, ...prev];
        });
        setEditingExercise(null);
        await storage.saveExercise(exerciseToSave);
        onUpdate(); 
    } catch (error) {
        console.error("Fel vid sparning:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm("Är du säker på att du vill ta bort denna övning?")) {
        const originalExercises = exercises;
        setExercises(prev => prev.filter(ex => ex.id !== id));
        setEditingExercise(null);
        try {
            await storage.deleteExercise(id);
            onUpdate();
        } catch (error) {
            setExercises(originalExercises);
        }
    }
  }

  const FilterPills = ({ items }: { items: string[] }) => (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(items || []).map(item => (
              <button key={item} onClick={() => setSelectedFilterValue(selectedFilterValue === item ? null : item)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all border ${selectedFilterValue === item ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-text-dim'}`}>{item}</button>
          ))}
      </div>
  );

  return (
    <div className="pb-32 animate-in fade-in space-y-4 px-4 h-full flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
      <header className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">{isSelectorMode ? 'Välj Övning' : 'Bibliotek'}</h2>
          {!isSelectorMode && (<p className="text-[10px] font-black text-text-dim uppercase tracking-widest mt-1">{(exercises || []).length} ÖVNINGAR I DATABASEN</p>)}
        </div>
        {(isSelectorMode || editingExercise) ? (<button onClick={() => { if (editingExercise) setEditingExercise(null); if (onClose) onClose(); }} className="p-4 bg-white/5 border border-white/5 text-white rounded-2xl"><X size={24} /></button>) : (
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAIScout(true)}
              className="p-4 bg-accent-blue/20 border border-accent-blue/30 text-accent-blue rounded-2xl flex items-center gap-2"
            >
              <Sparkles size={24} />
              <span className="text-[10px] font-black uppercase">Scout</span>
            </button>
            <button onClick={() => setEditingExercise({ id: `custom-${Date.now()}`, name: '', pattern: MovementPattern.ISOLATION, tier: 'tier_3', muscleGroups: [], primaryMuscles: [], secondaryMuscles: [], equipment: [], difficultyMultiplier: 1.0, bodyweightCoefficient: 0, trackingType: 'reps_weight', userModified: true, alternativeExIds: [], equipmentRequirements: [] })} className="p-4 bg-accent-pink text-white rounded-2xl"><Plus size={24} strokeWidth={3} /></button>
          </div>
        )}
      </header>

      <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
              <input type="text" placeholder="Sök övning..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-[24px] p-5 pl-14 outline-none focus:border-accent-pink/50 font-bold" />
            </div>
            <button onClick={() => setSortBy(sortBy === 'recent' ? 'alphabetical' : 'recent')} className={`p-5 rounded-[24px] border transition-all flex items-center gap-2 ${sortBy === 'recent' ? 'bg-accent-pink/10 border-accent-pink text-accent-pink' : 'bg-white/5 border-white/10 text-text-dim'}`}>{sortBy === 'recent' ? <Clock size={20} /> : <SortAsc size={20} />}</button>
          </div>
          <button onClick={() => setShowOnlyFavorites(!showOnlyFavorites)} className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${showOnlyFavorites ? 'bg-accent-pink/10 border-accent-pink text-accent-pink' : 'bg-white/5 border-white/5 text-text-dim'}`}><Heart size={14} fill={showOnlyFavorites ? 'currentColor' : 'none'} /> Visa Endast Favoriter ({exercises.filter(e => e.userRating === 'up').length})</button>
          <div className="flex bg-[#1a1721] p-1 rounded-2xl border border-white/5 overflow-x-auto shrink-0">{[{ id: 'all', label: 'Alla' }, { id: 'muscles', label: 'Muskler' }, { id: 'equipment', label: 'Utrustning' }, { id: 'pattern', label: 'Mönster' }].map(tab => (<button key={tab.id} onClick={() => { setActiveFilterTab(tab.id as any); setSelectedFilterValue(null); }} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFilterTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-text-dim hover:text-white'}`}>{tab.label}</button>))}</div>
          {activeFilterTab === 'muscles' && <FilterPills items={ALL_MUSCLE_GROUPS} />}
          {activeFilterTab === 'equipment' && <FilterPills items={Object.values(Equipment)} />}
          {activeFilterTab === 'pattern' && <FilterPills items={Object.values(MovementPattern)} />}
      </div>

      <div ref={listRef} className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto scrollbar-hide pt-2 pb-20">
        {visibleExercises.map(ex => (<div key={ex.id} onClick={() => { if (isSelectorMode && onSelect) onSelect(ex); else setEditingExercise(ex); }} className={`bg-[#1a1721] p-4 rounded-[28px] border flex items-center justify-between group animate-in fade-in slide-in-from-bottom-2 transition-colors cursor-pointer ${getLastUsed(ex.id) > 0 && sortBy === 'recent' ? 'border-accent-pink/20' : 'border-white/5 hover:border-white/10'}`}><div className="flex items-center gap-4 overflow-hidden flex-1"><ExerciseImage exercise={ex} /><div className="min-w-0"><h3 className="text-base font-black italic uppercase truncate text-white">{ex.name}</h3><p className="text-[10px] text-text-dim uppercase tracking-widest truncate mt-1">{ex.primaryMuscles?.join(', ') || ex.pattern}</p></div></div>{isSelectorMode && onSelect ? (<div className="p-3 bg-accent-pink rounded-xl text-white active:scale-90 transition-transform"><Plus size={18} /></div>) : (<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}><button onClick={() => handleRate(ex, 'up')} className={`p-3 rounded-xl transition-all ${ex.userRating === 'up' ? 'bg-green-500/20 text-green-500' : 'bg-white/10 text-text-dim'}`}><ThumbsUp size={16} fill={ex.userRating === 'up' ? "currentColor" : "none"}/></button><button onClick={() => handleRate(ex, 'down')} className={`p-3 rounded-xl transition-all ${ex.userRating === 'down' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-text-dim'}`}><ThumbsDown size={16} fill={ex.userRating === 'down' ? "currentColor" : "none"}/></button></div>)}</div>))}
        {filteredExercises.length > displayCount && (<button onClick={() => setDisplayCount(prev => prev + ITEMS_PER_PAGE)} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"><ChevronDown size={16} /> Visa fler övningar</button>)}
      </div>

      {editingExercise && !isSelectorMode && <ExerciseEditor exercise={editingExercise} history={history} allExercises={exercises} onClose={() => setEditingExercise(null)} onSave={handleSave} onDelete={handleDelete} userProfile={userProfile} />}
      
      {showAIScout && (
        <div className="fixed inset-0 z-[300] bg-[#0f0d15] flex flex-col">
          <div style={{ paddingTop: 'env(safe-area-inset-top)' }} className="flex-1 flex flex-col overflow-hidden">
            <AIExerciseRecommender 
              onClose={() => setShowAIScout(false)}
              allExercises={exercises}
              history={history}
              activeZone={activeZone}
              onUpdate={onUpdate}
              onEditExercise={(exerciseId) => {
                const exerciseToEdit = exercises.find(e => e.id === exerciseId);
                if (exerciseToEdit) {
                  setShowAIScout(false);
                  setEditingExercise(exerciseToEdit);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// --- FIX: Implementation of sub-components for ExerciseEditor ---

const InfoTab = ({ formData, setFormData, userProfile, allExercises }: { formData: Exercise, setFormData: React.Dispatch<React.SetStateAction<Exercise>>, userProfile?: UserProfile, allExercises: Exercise[] }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiFill = async () => {
    if (!formData.name) return alert("Ange övningens namn först");
    setIsGenerating(true);
    try {
      const details = await generateExerciseDetailsFromGemini(formData.name, allExercises);
      setFormData(prev => ({ ...prev, ...details }));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end mb-2">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Övningens Namn</label>
        <button 
          onClick={handleAiFill} 
          disabled={isGenerating || !formData.name}
          className="text-[9px] font-black uppercase bg-accent-blue/10 text-accent-blue px-3 py-1 rounded-lg border border-accent-blue/20 flex items-center gap-1.5 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          Fyll i med AI
        </button>
      </div>
      <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-pink" placeholder="T.ex. Bänkpress" />
      
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Engelskt Namn</label>
        <input type="text" value={formData.englishName || ''} onChange={e => setFormData({ ...formData, englishName: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue" placeholder="T.ex. Bench Press" />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Instruktioner</label>
        <textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium text-sm outline-none focus:border-accent-blue min-h-[120px]" placeholder="1. Sänk stången... 2. Pressa upp..." />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Bild</label>
        <ImageUpload currentImage={formData.image} onImageSaved={(base64) => setFormData({ ...formData, image: base64 })} />
      </div>
    </div>
  );
};

const MusclesTab = ({ formData, setFormData, toggleList }: { formData: Exercise, setFormData: React.Dispatch<React.SetStateAction<Exercise>>, toggleList: (list: string[], item: string) => string[] }) => (
  <div className="space-y-8 animate-in fade-in">
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Primära Muskler</label>
      <div className="grid grid-cols-2 gap-2">
        {ALL_MUSCLE_GROUPS.map(m => {
          const isSelected = formData.primaryMuscles.includes(m);
          return (
            <button key={m} onClick={() => setFormData({ ...formData, primaryMuscles: toggleList(formData.primaryMuscles, m) as MuscleGroup[] })} className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${isSelected ? 'bg-white text-black border-white' : 'bg-white/5 border-transparent text-text-dim'}`}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Sekundära Muskler</label>
      <div className="grid grid-cols-2 gap-2">
        {ALL_MUSCLE_GROUPS.map(m => {
          const isSelected = formData.secondaryMuscles?.includes(m);
          return (
            <button key={m} onClick={() => setFormData({ ...formData, secondaryMuscles: toggleList(formData.secondaryMuscles || [], m) as MuscleGroup[] })} className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${isSelected ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/30' : 'bg-white/5 border-transparent text-text-dim'}`}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

const ProgressionTab = ({ stats }: { stats: { history: any[], best1RM: number } }) => (
  <div className="space-y-6 animate-in fade-in">
    <div className="bg-gradient-to-br from-[#1a1721] to-[#110f16] p-6 rounded-[32px] border border-white/5">
      <p className="text-[10px] font-black uppercase text-text-dim tracking-widest mb-1">Beräknat 1RM (PB)</p>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black italic text-white">{Math.round(stats.best1RM)}</span>
        <span className="text-sm font-bold text-text-dim uppercase">kg</span>
      </div>
    </div>

    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Senaste Utveckling</label>
      {stats.history.length > 0 ? (
        [...stats.history].reverse().map((h, i) => (
          <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-white">{new Date(h.date).toLocaleDateString('sv-SE')}</p>
              <p className="text-[10px] text-text-dim uppercase font-bold">Volym: {Math.round(h.volume)}kg</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black italic text-accent-blue">{Math.round(h.max1RM)}kg</p>
              <p className="text-[8px] text-text-dim uppercase font-bold">Est. 1RM</p>
            </div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center opacity-30">
          <TrendingUp size={48} className="mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Ingen historik för denna övning</p>
        </div>
      )}
    </div>
  </div>
);

const SettingsTab = ({ formData, setFormData, onDelete, allExercises }: { formData: Exercise, setFormData: React.Dispatch<React.SetStateAction<Exercise>>, onDelete?: (id: string) => void, allExercises: Exercise[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredAlternatives = allExercises.filter(ex => 
    ex.id !== formData.id && 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !formData.alternativeExIds?.includes(ex.id)
  ).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Mönster</label>
          <select value={formData.pattern} onChange={e => setFormData({ ...formData, pattern: e.target.value as MovementPattern })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none">
            {Object.values(MovementPattern).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Tier</label>
          <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: e.target.value as ExerciseTier })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none">
            <option value="tier_1">Tier 1 (Bas)</option>
            <option value="tier_2">Tier 2 (Komp)</option>
            <option value="tier_3">Tier 3 (Isol)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Loggning</label>
          <select value={formData.trackingType} onChange={e => setFormData({ ...formData, trackingType: e.target.value as TrackingType })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none">
            <option value="reps_weight">Vikt & Reps</option>
            <option value="time_distance">Tid & Distans</option>
            <option value="reps_only">Endast Reps</option>
            <option value="time_only">Endast Tid</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Svårighet (Mult)</label>
          <input type="number" step="0.1" value={formData.difficultyMultiplier} onChange={e => setFormData({ ...formData, difficultyMultiplier: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Kroppsvikt (Coeff 0-1)</label>
        <input type="number" step="0.1" value={formData.bodyweightCoefficient} onChange={e => setFormData({ ...formData, bodyweightCoefficient: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold" />
      </div>

      <div className="space-y-4">
        <EquipmentBuilder value={formData.equipmentRequirements || []} onChange={(reqs) => setFormData({ ...formData, equipmentRequirements: reqs })} />
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Alternativa Övningar</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.alternativeExIds?.map(altId => (
            <span key={altId} className="bg-accent-blue/10 text-accent-blue px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
              {allExercises.find(e => e.id === altId)?.name || altId}
              <button onClick={() => setFormData({ ...formData, alternativeExIds: formData.alternativeExIds?.filter(id => id !== altId) })} className="text-accent-blue/50 hover:text-accent-blue"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Sök för att lägga till..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs" />
          {searchTerm && filteredAlternatives.length > 0 && (
            <div className="absolute z-10 w-full bg-[#2a2735] border border-white/10 rounded-xl mt-1 shadow-xl overflow-hidden">
              {filteredAlternatives.map(ex => (
                <button key={ex.id} onClick={() => { setFormData({ ...formData, alternativeExIds: [...(formData.alternativeExIds || []), ex.id] }); setSearchTerm(''); }} className="w-full text-left p-3 text-xs text-white hover:bg-white/5 border-b border-white/5 last:border-0">{ex.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {onDelete && (
        <button onClick={() => onDelete(formData.id)} className="w-full py-4 text-red-500 font-bold uppercase text-[10px] tracking-widest hover:bg-red-500/10 rounded-2xl transition-colors mt-8">
          Ta bort övning helt
        </button>
      )}
    </div>
  );
};

const ExerciseEditor: React.FC<{ exercise: Exercise, history: WorkoutSession[], allExercises: Exercise[], onClose: () => void, onSave: (ex: Exercise) => void, onDelete?: (id: string) => void, userProfile?: UserProfile }> = ({ exercise, history, allExercises, onClose, onSave, onDelete, userProfile }) => {
  const [formData, setFormData] = useState<Exercise>({ ...exercise, englishName: exercise.englishName || '', primaryMuscles: exercise.primaryMuscles || [], secondaryMuscles: exercise.secondaryMuscles || [], equipment: exercise.equipment || [], difficultyMultiplier: exercise.difficultyMultiplier ?? 1, bodyweightCoefficient: exercise.bodyweightCoefficient ?? 0, trackingType: exercise.trackingType || 'reps_weight', tier: exercise.tier || 'tier_3', alternativeExIds: exercise.alternativeExIds || [], equipmentRequirements: exercise.equipmentRequirements || [] });
  const [activeTab, setActiveTab] = useState<'info' | 'muscles' | 'settings' | 'progression'>('info');

  const stats = useMemo(() => {
    const exerciseHistory = (history || [])
        .map(session => ({
            date: session.date,
            volume: (session.exercises || [])
                .filter(ex => ex.exerciseId === formData.id)
                .reduce((total, ex) => total + (ex.sets || []).reduce((sTotal, s) => sTotal + ((s.weight || 0) * (s.reps || 0)), 0), 0),
            max1RM: Math.max(0, ...(session.exercises || [])
                .filter(ex => ex.exerciseId === formData.id)
                .flatMap(ex => (ex.sets || []).map(s => calculate1RM(s.weight || 0, s.reps || 0))))
        }))
        .filter(h => h.volume > 0 || h.max1RM > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { history: exerciseHistory, best1RM: Math.max(0, ...exerciseHistory.map(h => h.max1RM)) };
  }, [formData.id, history]);

  useEffect(() => { setFormData({ ...exercise, englishName: exercise.englishName || '', primaryMuscles: exercise.primaryMuscles || [], secondaryMuscles: exercise.secondaryMuscles || [], equipment: exercise.equipment || [], difficultyMultiplier: exercise.difficultyMultiplier ?? 1, bodyweightCoefficient: exercise.bodyweightCoefficient ?? 0, trackingType: exercise.trackingType || 'reps_weight', tier: exercise.tier || 'tier_3', alternativeExIds: exercise.alternativeExIds || [], equipmentRequirements: exercise.equipmentRequirements || [] }); }, [exercise]);
  const toggleList = (list: string[], item: string) => (list || []).includes(item) ? list.filter(i => i !== item) : [...(list || []), item];

  return (
    <div className="fixed inset-0 bg-[#0f0d15] z-[250] flex flex-col animate-in slide-in-from-bottom-10 overscroll-y-contain">
      <header className="flex justify-between items-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] border-b border-white/5 bg-[#0f0d15]"><h3 className="text-2xl font-black italic uppercase">Redigera Övning</h3><button onClick={onClose} className="p-2 bg-white/5 rounded-xl"><X size={24}/></button></header>
      <div className="flex p-4 gap-2 border-b border-white/5">{[{ id: 'info', label: 'Info', icon: Activity }, { id: 'muscles', label: 'Muskler', icon: Layers }, { id: 'progression', label: 'Progression', icon: TrendingUp }, { id: 'settings', label: 'Data', icon: Scale }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'bg-white text-black' : 'bg-white/5 text-text-dim'}`}><tab.icon size={16} /> {tab.label}</button>))}</div>
      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 overscroll-contain">
        {activeTab === 'info' && <InfoTab formData={formData} setFormData={setFormData} userProfile={userProfile} allExercises={allExercises} />}
        {activeTab === 'muscles' && <MusclesTab formData={formData} setFormData={setFormData} toggleList={toggleList} />}
        {activeTab === 'progression' && <ProgressionTab stats={stats} />}
        {activeTab === 'settings' && <SettingsTab formData={formData} setFormData={setFormData} onDelete={onDelete} allExercises={allExercises} />}
      </div>
      <div className="p-6 bg-[#0f0d15] border-t border-white/5 absolute bottom-0 left-0 right-0"><button onClick={() => onSave(formData)} className="w-full py-4 bg-white text-black rounded-2xl font-black italic uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"><Save size={20} /> Spara Ändringar</button></div>
    </div>
  );
};
