
import React, { useState, useEffect } from 'react';
import { UserMission, Exercise, ProgressionStrategy, SmartGoalTarget, BodyMeasurements, UserProfile, WorkoutSession } from '../types';
import { X, Trophy, TrendingUp, Dumbbell, Scale, Ruler, Search, Check, Target, Calendar, ListTodo, Hash } from 'lucide-react';
import { calculate1RM, getLastPerformance } from '../utils/fitness';

interface AddMissionModalProps {
  onClose: () => void;
  onSave: (mission: UserMission) => void;
  allExercises: Exercise[];
  userProfile: UserProfile;
  history: WorkoutSession[];
}

export const AddMissionModal: React.FC<AddMissionModalProps> = ({ onClose, onSave, allExercises, userProfile, history }) => {
  const [missionType, setMissionType] = useState<'smart_goal' | 'quest'>('smart_goal');
  
  // Data for Quest
  const [title, setTitle] = useState('');
  const [targetCount, setTargetCount] = useState(10);

  // Data för Smart Goal
  const [targetType, setTargetType] = useState<SmartGoalTarget>('exercise');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [measurementKey, setMeasurementKey] = useState<keyof BodyMeasurements | 'weight'>('waist');
  const [startValue, setStartValue] = useState(0);
  const [targetValue, setTargetValue] = useState(0);
  
  // Reps
  const [startReps, setStartReps] = useState(8); 
  const [targetReps, setTargetReps] = useState(5); 

  const [deadline, setDeadline] = useState('');
  const [strategy, setStrategy] = useState<ProgressionStrategy>('linear');
  
  // Sök-state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const fetchCurrent = () => {
      if (targetType === 'exercise' && selectedExerciseId) {
        const lastPerf = getLastPerformance(selectedExerciseId, history);
        let max = 0;
        if (lastPerf) {
           max = Math.max(...lastPerf.map(s => calculate1RM(s.weight || 0, s.reps || 0)));
        }
        if (max > 0) setStartValue(max);
      } else if (targetType === 'body_weight') {
        const bio = userProfile;
        if (bio.weight) setStartValue(bio.weight);
      }
    };
    fetchCurrent();
  }, [targetType, selectedExerciseId, history, userProfile]);

  const handleSave = () => {
    const isSmart = missionType === 'smart_goal';
    
    let finalTitle = title;
    if (isSmart && !finalTitle) {
        if (targetType === 'exercise') {
            const exName = allExercises.find(e => e.id === selectedExerciseId)?.name || 'Övning';
            finalTitle = `Öka ${exName} till ${targetValue}kg`;
        } else if (targetType === 'body_weight') {
            finalTitle = `Nå ${targetValue}kg kroppsvikt`;
        } else {
            finalTitle = `Mål för ${measurementKey}`;
        }
    }

    const newMission: UserMission = {
      id: `m-${Date.now()}`,
      title: finalTitle || 'Nytt uppdrag',
      type: missionType,
      isCompleted: false,
      progress: 0,
      total: isSmart ? targetValue : targetCount,
      createdAt: new Date().toISOString(),
      
      ...(isSmart && {
        exerciseId: selectedExerciseId,
        smartConfig: {
          targetType,
          exerciseId: targetType === 'exercise' ? selectedExerciseId : undefined,
          measurementKey: targetType === 'body_measurement' ? measurementKey : (targetType === 'body_weight' ? 'weight' : undefined),
          startValue,
          targetValue,
          deadline,
          strategy,
          startReps: targetType === 'exercise' ? startReps : undefined,
          targetReps: targetType === 'exercise' ? targetReps : undefined,
        }
      })
    };
    
    onSave(newMission);
  };
  
  const handleNumericFocus = (currentVal: number, setter: (v: any) => void) => {
    if (currentVal === 0) setter('');
  };

  const handleNumericBlur = (currentVal: any, setter: (v: number) => void) => {
    if (currentVal === "" || isNaN(Number(currentVal))) setter(0);
  };
  
  return (
    <div className="fixed inset-0 z-[60] bg-[#1a1721] flex flex-col h-full w-full animate-in fade-in duration-300">
      
      <div className="shrink-0 bg-[#1a1721] pt-[env(safe-area-inset-top)] border-b border-white/5">
        <div className="flex justify-between items-center p-4 h-16">
          <h3 className="text-xl font-black italic uppercase text-white">Nytt Mål</h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 active:bg-white/10"
          >
            <X className="text-white" size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain pb-32">
        
        <div className="flex bg-white/5 p-1 rounded-xl">
            <button onClick={() => setMissionType('smart_goal')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${missionType === 'smart_goal' ? 'bg-accent-blue text-white shadow-lg' : 'text-text-dim'}`}>
              <TrendingUp size={16} /> Mätbart
            </button>
            <button onClick={() => setMissionType('quest')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 transition-colors ${missionType === 'quest' ? 'bg-accent-blue text-white shadow-lg' : 'text-text-dim'}`}>
              <Trophy size={16} /> Uppdrag
            </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-text-dim">Namn</label>
          <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder={missionType === 'smart_goal' ? "T.ex. Bli stark i bänkpress" : "T.ex. Stretcha varje morgon"}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold placeholder:text-white/20" 
          />
        </div>

        {missionType === 'smart_goal' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex gap-2">
              {[
                { id: 'exercise', icon: Dumbbell, label: 'Övning' },
                { id: 'body_weight', icon: Scale, label: 'Vikt' },
                { id: 'body_measurement', icon: Ruler, label: 'Mått' }
              ].map(t => (
                <button key={t.id} onClick={() => setTargetType(t.id as any)} className={`flex-1 py-4 border border-white/10 rounded-xl flex flex-col items-center gap-2 transition-colors ${targetType === t.id ? 'bg-white/10 border-accent-blue text-white' : 'text-text-dim'}`}>
                  <t.icon size={20} />
                  <span className="text-[10px] font-black uppercase">{t.label}</span>
                </button>
              ))}
            </div>

            {targetType === 'exercise' && (
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black uppercase text-text-dim">Välj Övning</label>
                  <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
                      <input 
                          type="text"
                          placeholder="Sök övning..."
                          value={searchTerm}
                          onFocus={() => setIsSearching(true)}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 p-4 text-white font-bold outline-none focus:border-accent-blue transition-colors"
                      />
                        {searchTerm && (
                          <button 
                              onClick={() => { setSearchTerm(''); setSelectedExerciseId(''); }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-text-dim active:text-white"
                          >
                              <X size={16} />
                          </button>
                      )}
                  </div>
                  
                  {isSearching && (
                      <div className="absolute z-20 w-full bg-[#2a2735] border border-white/10 rounded-xl mt-2 max-h-64 overflow-y-auto shadow-2xl">
                          {allExercises
                              .filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(ex => (
                                  <button
                                      key={ex.id}
                                      onClick={() => {
                                          setSelectedExerciseId(ex.id);
                                          setSearchTerm(ex.name);
                                          setIsSearching(false);
                                      }}
                                      className="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center justify-between group"
                                  >
                                      <span className="text-white font-bold">{ex.name}</span>
                                      {selectedExerciseId === ex.id && <Check size={18} className="text-accent-green" />}
                                  </button>
                              ))
                          }
                          {allExercises.length === 0 && <div className="p-4 text-center text-text-dim text-xs">Inga övningar hittades</div>}
                      </div>
                  )}
                </div>
            )}
            
            {targetType === 'body_measurement' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-text-dim">Mätpunkt</label>
                  <div className="relative">
                    <select 
                      value={measurementKey} 
                      onChange={e => setMeasurementKey(e.target.value as any)} 
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold outline-none appearance-none"
                    >
                      <option value="waist">Midja</option>
                      <option value="bicepsL">Biceps</option>
                      <option value="chest">Bröst</option>
                      <option value="thighL">Lår</option>
                    </select>
                  </div>
                </div>
            )}

            {targetType === 'exercise' && (
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-text-dim">Start Reps</label>
                      <input type="number" onFocus={e => e.target.select()} value={startReps} onChange={e => setStartReps(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-text-dim">Mål Reps (1=Max)</label>
                      <input type="number" onFocus={e => e.target.select()} value={targetReps} onChange={e => setTargetReps(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold text-accent-green" />
                  </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-text-dim">Start ({targetType === 'body_measurement' ? 'cm' : 'kg'})</label>
                  <input type="number" onFocus={(e) => handleNumericFocus(startValue, setStartValue)} onBlur={(e) => handleNumericBlur(e.target.value, setStartValue)} value={startValue} onChange={e => setStartValue(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-text-dim">Mål ({targetType === 'body_measurement' ? 'cm' : 'kg'})</label>
                  <input type="number" onFocus={(e) => handleNumericFocus(targetValue, setTargetValue)} onBlur={(e) => handleNumericBlur(e.target.value, setTargetValue)} value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold text-accent-green" />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-text-dim">Deadline</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold min-h-[56px]" />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-text-dim">Strategi</label>
                <div className="flex gap-2">
                    {['linear', 'undulating', 'peaking'].map((s) => (
                      <button key={s} onClick={() => setStrategy(s as any)} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase border transition-all ${strategy === s ? 'bg-white text-black border-white' : 'border-white/10 text-text-dim hover:bg-white/5'}`}>
                        {s === 'linear' ? 'Linjär' : s === 'undulating' ? 'Vågform' : 'Toppning'}
                      </button>
                    ))}
                </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-text-dim">Mål-antal (om uppdraget ska repeteras)</label>
                <input type="number" onFocus={(e) => handleNumericFocus(targetCount, setTargetCount)} onBlur={(e) => handleNumericBlur(e.target.value, setTargetCount)} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold" placeholder="T.ex. 10" />
              </div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-white/5 bg-[#1a1721] pb-[calc(env(safe-area-inset-bottom)+1rem)] z-50">
          <button onClick={handleSave} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest hover:bg-gray-200 active:scale-[0.98] transition-all">Spara Mål</button>
      </div>
    </div>
  );
};
