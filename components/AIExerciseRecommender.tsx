
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Plus, ArrowRight, Trash2, History, Dumbbell, Save, Info, Sparkles, Play, AlertTriangle, X } from 'lucide-react';
import { recommendExercises, ExerciseRecommendation, ExerciseSearchResponse } from '../services/geminiService';
import { storage } from '../services/storage';
import { Exercise, ScheduledActivity, SetType, Zone, WorkoutSession } from '../types';
import { registerBackHandler } from '../utils/backHandler';
import { ExerciseInfoModal } from './ExerciseInfoModal';

interface AIExerciseRecommenderProps {
  onEditExercise?: (exerciseId: string) => void;
  onStartSession?: (activity: ScheduledActivity) => void;
  onClose?: () => void;
  allExercises: Exercise[];
  history: WorkoutSession[];
  onUpdate: () => void;
  activeZone?: Zone;
}

const HISTORY_KEY = 'gym_ai_scout_history_v3';
const MAX_HISTORY = 20;

interface HistoryItem {
    query: string;
    response: ExerciseSearchResponse;
    timestamp: number;
}

export const AIExerciseRecommender: React.FC<AIExerciseRecommenderProps> = ({ onEditExercise, onStartSession, onClose, allExercises, onUpdate, history: fullHistory }) => {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<ExerciseSearchResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);
  
  // NY STATE: Håller koll på övningar vi lagt till just nu för direkt UI-feedback
  const [locallyAdded, setLocallyAdded] = useState<string[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (currentResult || viewingExercise) {
      return registerBackHandler(() => {
        if (viewingExercise) setViewingExercise(null);
        else if (currentResult) setCurrentResult(null);
      });
    }
  }, [currentResult, viewingExercise]);
  
  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        setHistory(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Kunde inte ladda historik");
    }
  };

  const saveToHistory = (query: string, response: ExerciseSearchResponse) => {
    const newItem: HistoryItem = { query, response, timestamp: Date.now() };
    const updatedHistory = [newItem, ...history]
        .filter((v, i, a) => a.findIndex(t => t.query.toLowerCase() === v.query.toLowerCase()) === i)
        .slice(0, MAX_HISTORY);
    
    setHistory(updatedHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    if(confirm("Vill du rensa all sökhistorik?")) {
        setHistory([]);
        localStorage.removeItem(HISTORY_KEY);
    }
  };

  const handleSearch = async () => {
    if (!request.trim()) return;
    setLoading(true);
    setCurrentResult(null); 
    setCurrentQuery(request);
    try {
      const result = await recommendExercises(request, allExercises);
      setCurrentResult(result);
      saveToHistory(request, result);
    } catch (e) {
      alert("Kunde inte hämta förslag. Kontrollera din anslutning.");
    } finally {
      setLoading(false);
    }
  };

  const sanitizeId = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleAddExercise = async (rec: ExerciseRecommendation) => {
    try {
        let cleanId = sanitizeId(rec.data.id || rec.data.name);
        if (!cleanId || cleanId.length < 2) cleanId = `ex-${Date.now()}`;

        const exists = allExercises.find(e => e.id === cleanId || e.name.toLowerCase() === rec.data.name.toLowerCase());
        if (exists) {
            onUpdate();
            return;
        }

        const exerciseToSave: Exercise = {
            ...rec.data,
            id: cleanId, 
            userModified: true,
            muscleGroups: rec.data.muscleGroups || Array.from(new Set([...rec.data.primaryMuscles, ...(rec.data.secondaryMuscles || [])]))
        };

        await storage.saveExercise(exerciseToSave);
        
        // UPPDATERING: Lägg till ID:t i lokal state direkt
        setLocallyAdded(prev => [...prev, cleanId]);
        
        onUpdate(); // Säg till appen att uppdatera DB-listan

    } catch (error) {
        console.error("Fel vid sparande av övning:", error);
        alert("Kunde inte spara övningen. Försök igen.");
    }
  };

  const getExistingExerciseId = (rec: ExerciseRecommendation): string | null => {
    const cleanId = sanitizeId(rec.data.id || rec.data.name);
    if (locallyAdded.includes(cleanId)) return cleanId;

    const exactMatch = allExercises.find(e => e.id === rec.data.id);
    if (exactMatch) return exactMatch.id;

    const slugMatch = allExercises.find(e => e.id === cleanId);
    if (slugMatch) return slugMatch.id;

    const nameMatch = allExercises.find(e => e.name.toLowerCase() === rec.data.name.toLowerCase());
    if (nameMatch) return nameMatch.id;

    if (rec.existingId) {
        const existingMatch = allExercises.find(e => e.id === rec.existingId);
        if (existingMatch) return existingMatch.id;
    }

    return null;
  };

  const handleStartWorkout = () => {
    if (!currentResult || !onStartSession) return;

    const availableExercises = currentResult.recommendations
        .map(rec => {
            const id = getExistingExerciseId(rec);
            return id ? { id, name: rec.data.name } : null;
        })
        .filter((item): item is { id: string, name: string } => item !== null);

    if (availableExercises.length === 0) {
        alert("Inga av de föreslagna övningarna finns i ditt bibliotek än. Lägg till dem först genom att klicka på 'Lägg till' i listan.");
        return;
    }

    const exercisesToRun = availableExercises.slice(0, 15);

    const activity: ScheduledActivity = {
        id: `scout-session-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'gym',
        title: `AI Scout: ${currentQuery || 'Övningsscout'}`,
        isCompleted: false,
        exercises: exercisesToRun.map(ex => ({
            exerciseId: ex.id,
            sets: [
                { reps: 10, weight: 0, completed: false, type: 'normal' as SetType },
                { reps: 10, weight: 0, completed: false, type: 'normal' as SetType },
                { reps: 10, weight: 0, completed: false, type: 'normal' as SetType }
            ],
            notes: "Genererat från Övningsscout"
        }))
    };
    onStartSession(activity);
  };

  const readyCount = currentResult 
    ? currentResult.recommendations.filter(r => getExistingExerciseId(r) !== null).length 
    : 0;

  const renderRecommendations = (recs: ExerciseRecommendation[]) => (
    <div className="space-y-3">
        {recs.map((rec, idx) => {
            const existingId = getExistingExerciseId(rec);
            const exists = !!existingId;

            const handleCardClick = () => {
                if (exists) {
                    const exerciseToShow = allExercises.find(e => e.id === existingId);
                    if (exerciseToShow) setViewingExercise(exerciseToShow);
                }
            };

            return (
                <div 
                  key={idx} 
                  onClick={handleCardClick}
                  className={`p-5 rounded-[28px] border flex flex-col gap-4 animate-in slide-in-from-bottom-2 shadow-lg transition-all ${exists ? 'bg-[#1a1721] border-white/5 cursor-pointer' : 'bg-gradient-to-br from-[#1a1721] to-[#2a2435] border-accent-blue/20'}`}
                >
                    <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <h3 className="text-white font-black italic uppercase text-lg truncate leading-none">{rec.data.name}</h3>
                                {!exists ? (
                                    <span className="bg-purple-500/20 text-purple-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-purple-500/30">Ny</span>
                                ) : (
                                    <span className="bg-green-500/20 text-green-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-green-500/10 flex items-center gap-1">
                                        <Save size={8}/> Sparad
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-accent-blue italic leading-snug line-clamp-2">"{rec.reason}"</p>
                        </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                        {rec.data.primaryMuscles?.slice(0, 2).map(m => (
                            <span key={m} className="text-[8px] font-black uppercase bg-white/5 text-text-dim px-2 py-1 rounded-lg border border-white/5">{m}</span>
                        ))}
                    </div>

                    <div className="pt-2 border-t border-white/5 mt-1">
                        {exists ? (
                            <div className="w-full py-3.5 rounded-2xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/5">
                                <Info size={14} /> Visa Info & Historik
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleAddExercise(rec); }}
                                className="w-full py-3.5 rounded-2xl bg-[#2ed573] hover:bg-[#26b963] text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-500/10"
                            >
                                <Plus size={16} strokeWidth={3} /> Lägg till i bibliotek
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4">
        {onClose && (
            <div className="flex justify-end pt-4">
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white"><X size={20}/></button>
            </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-24">
        <div className="bg-gradient-to-br from-[#1a1721] to-[#2a2435] p-6 rounded-[32px] border border-accent-blue/20 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent-blue/10 rounded-full">
                    <Dumbbell className="text-accent-blue" size={24} />
                </div>
                <h2 className="text-xl font-black uppercase italic text-white">Övnings-scout</h2>
            </div>
            
            <p className="text-xs text-text-dim mb-4 leading-relaxed">
                Hitta nya övningar för dina specifika mål. Jag scannar biblioteket och skapar det som saknas med fullständiga instruktioner.
            </p>

            <div className="relative">
                <textarea 
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="T.ex. 'Jag vill ha övningar för explosivitet'..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-base min-h-[100px] focus:border-accent-blue outline-none transition-all resize-none mb-4 shadow-inner"
                />
                {request && (
                    <button 
                        onClick={() => { setRequest(''); setCurrentResult(null); }}
                        className="absolute top-2 right-2 text-text-dim hover:text-white p-2"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <button 
                onClick={handleSearch}
                disabled={loading || !request}
                className="w-full bg-[#2ed573] hover:bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} strokeWidth={3} />}
                {loading ? 'SCANNAR BIBLIOTEKET...' : 'HITTA ÖVNINGAR'}
            </button>
        </div>

        {currentResult && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#1a1721] p-5 rounded-[28px] border border-white/10 flex flex-col gap-4 shadow-xl">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Info size={16} className="text-accent-blue" />
                            <span className="text-[10px] font-black uppercase text-accent-blue tracking-widest">Coach Analys</span>
                        </div>
                        <span className="text-[10px] text-text-dim font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                            {readyCount} av {currentResult.recommendations.length} i bibblan
                        </span>
                    </div>
                    
                    <p className="text-sm text-white italic leading-relaxed">"{currentResult.motivation}"</p>
                    
                    {onStartSession && (
                      <>
                        <button 
                            onClick={handleStartWorkout}
                            disabled={readyCount === 0}
                            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${
                                readyCount > 0 
                                ? 'bg-[#2ed573] hover:bg-white text-black shadow-green-500/20' 
                                : 'bg-white/5 text-text-dim cursor-not-allowed opacity-50'
                            }`}
                        >
                            <Play size={20} fill={readyCount > 0 ? "black" : "transparent"} strokeWidth={3} /> 
                            {readyCount > 0 ? `Starta pass (${Math.min(readyCount, 15)} övn)` : 'Inga sparade övningar'}
                        </button>
                        
                        {readyCount === 0 && (
                            <div className="flex items-center gap-2 text-yellow-500/80 text-[9px] font-bold uppercase justify-center">
                                <AlertTriangle size={12} />
                                <span>Lägg till övningar i biblioteket först (Plus-knappen nedan)</span>
                            </div>
                        )}
                      </>
                    )}
                </div>

                <div className="flex items-center justify-between px-2">
                    <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                        <Sparkles size={14} className="text-accent-blue"/> Resultat
                    </h3>
                </div>
                
                {renderRecommendations(currentResult.recommendations)}
            </div>
        )}

        {!currentResult && (
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2 pt-2">
                    <h3 className="text-text-dim font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14}/> Historik
                    </h3>
                    {history.length > 0 && (
                        <button onClick={clearHistory} className="text-[10px] text-red-400 font-black uppercase hover:text-red-300 flex items-center gap-1 transition-colors">
                            <Trash2 size={12}/> Rensa
                        </button>
                    )}
                </div>

                {history.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[28px] opacity-30">
                        <History size={32} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Ingen historik än</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item, idx) => (
                            <div key={idx} className="bg-[#1a1721] rounded-[28px] border border-white/5 overflow-hidden shadow-xl active:scale-[0.98] transition-transform">
                                <button 
                                    className="w-full p-5 flex justify-between items-center text-left"
                                    onClick={() => {
                                        setCurrentResult(item.response);
                                        setCurrentQuery(item.query);
                                    }}
                                >
                                    <div className="min-w-0 flex-1 pr-4">
                                        <p className="text-white font-bold text-sm truncate">"{item.query}"</p>
                                        <p className="text-[9px] text-text-dim uppercase font-black mt-1 tracking-widest">{item.response.recommendations.length} förslag</p>
                                    </div>
                                    <ArrowRight size={18} className="text-text-dim shrink-0"/>
                                </button>
                                <div className="px-5 pb-5 flex gap-2 overflow-x-auto scrollbar-hide">
                                    {item.response.recommendations.slice(0, 3).map((rec, i) => (
                                        <span key={i} className="text-[8px] font-black uppercase bg-white/5 text-text-dim px-2 py-1 rounded-lg border border-white/5 whitespace-nowrap">
                                            {rec.data.name}
                                        </span>
                                    ))}
                                    {item.response.recommendations.length > 3 && (
                                        <span className="text-[8px] font-black text-text-dim self-center">+{item.response.recommendations.length - 3} till</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>
      {viewingExercise && (
        <ExerciseInfoModal 
            exercise={viewingExercise}
            onClose={() => setViewingExercise(null)}
            history={fullHistory}
            allExercises={allExercises}
        />
      )}
    </div>
  );
};
