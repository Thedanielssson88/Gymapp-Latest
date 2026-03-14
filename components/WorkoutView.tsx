import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WorkoutSession, Zone, Exercise, MuscleGroup, WorkoutSet, Equipment, UserProfile, SetType, ScheduledActivity, PlannedActivityForLogDisplay, RecurringPlanForDisplay, PlannedExercise, UserMission, TrackingType } from '../types';
import { findReplacement, adaptVolume, getLastPerformance, createSmartSets, generateWorkoutSession, calculate1RM } from '../utils/fitness';
import { storage } from '../services/storage';
import { db } from '../services/db';
import { calculateExerciseImpact } from '../utils/recovery';
import { WorkoutSummaryModal } from './WorkoutSummaryModal';
import { WorkoutGenerator } from './WorkoutGenerator';
import { WorkoutHeader } from './WorkoutHeader';
import { WorkoutStats } from './WorkoutStats';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseLibrary } from './ExerciseLibrary';
import { registerBackHandler } from '../utils/backHandler';
import { Search, X, Plus, RefreshCw, Info, Sparkles, History, BookOpen, ArrowDownToLine, MapPin, Check, ArrowRightLeft, Dumbbell, Play, Pause, Timer as TimerIcon, AlertCircle, Thermometer, Zap, Activity, Shuffle, Calendar, Trophy, ArrowRight, Repeat, MessageSquare } from 'lucide-react';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';
import { triggerHaptic } from '../utils/haptics';
import { ConfirmModal } from './ConfirmModal';
import { calculateSmartProgression } from '../utils/progression';
import { ExerciseInfoModal } from './ExerciseInfoModal';
import { TypeSelectorModal } from './TypeSelectorModal';
import { ImageUpload } from './ImageUpload';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface WorkoutViewProps {
  session: WorkoutSession | null;
  allExercises: Exercise[];
  userProfile: UserProfile;
  allZones: Zone[];
  history: WorkoutSession[];
  activeZone: Zone;
  onZoneChange: (zone: Zone) => void;
  onComplete: (session: WorkoutSession, duration: number) => void;
  onCancel: () => void;
  plannedActivities: PlannedActivityForLogDisplay[];
  onStartActivity: (activity: ScheduledActivity) => void;
  onStartEmptyWorkout: () => void;
  onUpdate: () => void;
  isManualMode?: boolean;
  userMissions: UserMission[];
  onGoToExercise: (exerciseId: string) => void;
}

export const WorkoutView: React.FC<WorkoutViewProps> = ({ 
  session, allExercises, userProfile, allZones, history, activeZone, 
  onZoneChange, onComplete, onCancel, plannedActivities, onStartActivity, onStartEmptyWorkout, onUpdate,
  userMissions, isManualMode = false, onGoToExercise
}) => {
  const [localSession, setLocalSession] = useState<WorkoutSession | null>(session);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [openNotesIdx, setOpenNotesIdx] = useState<number | null>(null);
  const [infoModalData, setInfoModalData] = useState<{ exercise: Exercise; index: number } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [localShowZonePicker, setLocalShowZonePicker] = useState(false); // Lokalt state för gymbyten inuti pass
  const [showNoSetsInfo, setShowNoSetsInfo] = useState(false);
  const [highlightedExIdx, setHighlightedExIdx] = useState<number | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [typeSelectorData, setTypeSelectorData] = useState<{ exIdx: number; currentType: TrackingType } | null>(null);
  const [imageUploadTarget, setImageUploadTarget] = useState<Exercise | null>(null);

  useEffect(() => {
    if (session) {
      // Registrera Android Back för att öppna modalen istället för att stänga passet direkt
      return registerBackHandler(() => {
        setShowCancelConfirm(true);
      });
    }
  }, [session]);

  // --- NYA BACK HANDLERS ---
  useEffect(() => {
    if (showGenerator) return registerBackHandler(() => setShowGenerator(false));
    if (showAddModal) return registerBackHandler(() => setShowAddModal(false));
    if (localShowZonePicker) return registerBackHandler(() => setLocalShowZonePicker(false));
    if (showSummary) return registerBackHandler(() => setShowSummary(false));
    if (exerciseToDelete !== null) return registerBackHandler(() => setExerciseToDelete(null));
    if (typeSelectorData) return registerBackHandler(() => setTypeSelectorData(null));
    if (imageUploadTarget) return registerBackHandler(() => setImageUploadTarget(null));
  }, [showGenerator, showAddModal, localShowZonePicker, showSummary, exerciseToDelete, typeSelectorData, imageUploadTarget]);


  useEffect(() => {
    setLocalSession(session);
    if (session) {
      setIsTimerActive(false);
      if (isManualMode) {
        setTimer(0);
      }
    }
  }, [session, isManualMode]);

  useEffect(() => {
    let interval: any;
    if (isTimerActive && !isManualMode) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, isManualMode]);

  const triggerRestEndHaptics = async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.warn('Haptics stöds inte på denna enhet', e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (restTimer !== null && restTimer > 0) {
      // Countdown haptics logic
      if (!isManualMode && (userProfile.settings?.vibrateTimer ?? true)) {
        if (restTimer <= 5 && restTimer > 0) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
      }
      interval = setInterval(() => setRestTimer(r => (r !== null ? r - 1 : 0)), 1000);
    } else if (restTimer === 0) {
      if (!isManualMode && (userProfile.settings?.vibrateTimer ?? true)) {
        triggerRestEndHaptics();
      }
      setRestTimer(null);
    }
    return () => clearInterval(interval);
  }, [restTimer, userProfile.settings?.vibrateTimer, isManualMode]);

  const canFinishWorkout = useMemo(() => {
    if (!localSession) return false;
    return (localSession.exercises || []).some(ex => 
      ex.sets.some(set => set.completed)
    );
  }, [localSession]);

  const handleImageSaved = async (base64: string) => {
    if (!imageUploadTarget) return;

    try {
        await db.exercises.update(imageUploadTarget.id, { image: base64 });
        onUpdate();
        setImageUploadTarget(null);
    } catch (error) {
        console.error("Failed to save image for exercise:", error);
        alert("Bilden kunde inte sparas.");
        setImageUploadTarget(null);
    }
  };

  const handleChangeTrackingType = async (exIdx: number, newType: TrackingType) => {
    const exerciseId = localSession?.exercises[exIdx]?.exerciseId;
  
    // Optimistic UI update for current session
    setLocalSession(prev => {
      if (!prev) return null;
      const newExercises = [...prev.exercises];
      newExercises[exIdx] = { ...newExercises[exIdx], trackingTypeOverride: newType };
      const updatedSession = { ...prev, exercises: newExercises };
      storage.setActiveSession(updatedSession);
      return updatedSession;
    });
  
    setTypeSelectorData(null);
  
    if (exerciseId) {
      try {
        await db.exercises.update(exerciseId, { trackingType: newType });
        console.log(`Saved new default tracking type '${newType}' for exercise ${exerciseId}`);
        onUpdate();
      } catch (error) {
        console.error("Could not save exercise setting globally:", error);
      }
    }
  };

  const handleSwitchZone = (targetZone: Zone) => {
    if (targetZone.id === activeZone.id) return;
    setLocalSession(prev => {
      if (!prev) return null;
      const newExercises = (prev.exercises || []).map(item => {
        const currentEx = (allExercises || []).find(e => e.id === item.exerciseId);
        if (!currentEx) return item;
        const replacement = findReplacement(currentEx, targetZone, allExercises || []);
        if (replacement.id === currentEx.id) return item;
        const newSets = adaptVolume(item.sets || [], currentEx, replacement, userProfile.goal);
        return { ...item, exerciseId: replacement.id, sets: newSets };
      });
      const updatedSession = { ...prev, zoneId: targetZone.id, exercises: newExercises };
      storage.setActiveSession(updatedSession);
      return updatedSession;
    });
    onZoneChange(targetZone);
  };

  const handleSwapExercise = (exIdx: number, newExerciseId: string) => {
    setLocalSession(prev => {
        if (!prev) return null;
        const updatedExercises = [...(prev.exercises || [])];
        const itemToSwap = updatedExercises[exIdx];
        const currentEx = (allExercises || []).find(e => e.id === itemToSwap.exerciseId);
        const newEx = (allExercises || []).find(e => e.id === newExerciseId);
        if (!currentEx || !newEx) return prev;
        const newSets = adaptVolume(itemToSwap.sets || [], currentEx, newEx, userProfile.goal);
        updatedExercises[exIdx] = { ...itemToSwap, exerciseId: newEx.id, sets: newSets };
        const updatedSession = { ...prev, exercises: updatedExercises };
        storage.setActiveSession(updatedSession);
        return updatedSession;
    });
    setInfoModalData(null);
  };

  const handleApplyHistory = (exIdx: number, setsToApply: WorkoutSet[]) => {
      setLocalSession(prev => {
          if (!prev) return null;
          const updatedExercises = [...(prev.exercises || [])];
          const newSets = (setsToApply || []).map(s => ({ ...s, completed: false, rpe: undefined }));
          updatedExercises[exIdx] = { ...updatedExercises[exIdx], sets: newSets };
          const updatedSession = { ...prev, exercises: updatedExercises };
          storage.setActiveSession(updatedSession);
          return updatedSession;
      });
      setInfoModalData(null);
  };

  const updateSet = useCallback((exIdx: number, setIdx: number, updates: Partial<WorkoutSet>) => {
    if (updates.completed) {
        triggerHaptic.success(userProfile);
    }
    
    setLocalSession(prev => {
        if (!prev) return null;
        
        const updatedExercises = [...(prev.exercises || [])];
        const exercise = { ...updatedExercises[exIdx] };
        const updatedSets = [...(exercise.sets || [])];
        updatedSets[setIdx] = { ...updatedSets[setIdx], ...updates };
        exercise.sets = updatedSets;
        updatedExercises[exIdx] = exercise;

        if (updates.completed && exercise.supersetId) {
            const wasOldSetIncomplete = !prev.exercises[exIdx].sets[setIdx].completed;

            if (wasOldSetIncomplete) {
                const allExercisesInSuperset = updatedExercises.filter(ex => ex.supersetId === exercise.supersetId);
                const isSupersetNowFinished = allExercisesInSuperset.every(ex => ex.sets.every(s => s.completed));
                
                if (isSupersetNowFinished) {
                    triggerHaptic.double(userProfile);
                }
            }
        }
        
        const hasValueChange = 'weight' in updates || 'reps' in updates || 'distance' in updates || 'duration' in updates;
        if (hasValueChange) {
            for (let i = setIdx + 1; i < updatedSets.length; i++) {
                const nextSet = updatedSets[i];
                const isNextSetEmpty = (nextSet.weight === 0 || nextSet.weight === undefined) && 
                                     (nextSet.reps === 0 || nextSet.reps === undefined) &&
                                     (nextSet.distance === 0 || nextSet.distance === undefined) &&
                                     (nextSet.duration === 0 || nextSet.duration === undefined);
    
                if (isNextSetEmpty) {
                    updatedSets[i] = {
                        ...nextSet,
                        weight: updatedSets[setIdx].weight ?? nextSet.weight,
                        reps: updatedSets[setIdx].reps ?? nextSet.reps,
                        distance: updatedSets[setIdx].distance ?? nextSet.distance,
                        duration: updatedSets[setIdx].duration ?? nextSet.duration,
                        type: updatedSets[setIdx].type === 'warmup' ? 'normal' : (updatedSets[setIdx].type ?? nextSet.type),
                    };
                } else {
                    break;
                }
            }
        }
    
        if (updates.completed && exercise.supersetId) {
            const allExercises = updatedExercises;
            const supersetGroup = allExercises
              .map((ex, idx) => ({ ...ex, originalIdx: idx }))
              .filter(ex => ex.supersetId === exercise.supersetId);
        
            if (supersetGroup.length > 1) {
              const currentInGroupIdx = supersetGroup.findIndex(g => g.originalIdx === exIdx);
              let nextTargetIdx = -1;
        
              for (let i = 1; i <= supersetGroup.length; i++) {
                const checkIdx = (currentInGroupIdx + i) % supersetGroup.length;
                const candidate = supersetGroup[checkIdx];
                
                if (candidate.sets.some(s => !s.completed)) {
                  nextTargetIdx = candidate.originalIdx;
                  break;
                }
              }
        
              if (nextTargetIdx !== -1 && nextTargetIdx !== exIdx) {
                setTimeout(() => {
                  const element = document.getElementById(`exercise-row-${nextTargetIdx}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setHighlightedExIdx(nextTargetIdx);
                    setTimeout(() => setHighlightedExIdx(null), 1200);
                  }
                }, 150);
              }
            }
        }

        const updatedSession = { ...prev, exercises: updatedExercises };
        storage.setActiveSession(updatedSession);
        return updatedSession;
    });

    if (updates.completed && !isManualMode) {
      setRestTimer(90);
    }
  }, [isManualMode, userProfile]);

  const updateNotes = useCallback((exIdx: number, notes: string) => {
    setLocalSession(prev => {
      if (!prev) return null;
      const updatedExercises = [...(prev.exercises || [])];
      updatedExercises[exIdx] = { ...updatedExercises[exIdx], notes };
      const updatedSession = { ...prev, exercises: updatedExercises };
      storage.setActiveSession(updatedSession);
      return updatedSession;
    });
  }, []);

  const confirmDeleteExercise = useCallback(async () => {
    if (exerciseToDelete === null) return;
    
    const exIdx = exerciseToDelete;
    const exerciseToRemove = localSession?.exercises[exIdx];
    
    setLocalSession(prevSession => {
      if (!prevSession) return null;
      const updatedExercises = (prevSession.exercises || []).filter((_, index) => index !== exIdx);
      const newSession = { ...prevSession, exercises: updatedExercises };
      storage.setActiveSession(newSession);
      return newSession;
    });

    setOpenNotesIdx(null);
    
    if (exerciseToRemove) {
      const exData = allExercises.find(e => e.id === exerciseToRemove.exerciseId);
      if (exData) {
          const newScore = Math.max(1, (exData.score || 5) - 1);
          await storage.saveExercise({ ...exData, score: newScore });
          onUpdate();
      }
    }
    setExerciseToDelete(null);
  }, [exerciseToDelete, localSession, allExercises, onUpdate]);

  const addSetToExercise = useCallback((exIdx: number) => {
    setLocalSession(prev => {
      if (!prev) return null;
      const updatedExercises = [...(prev.exercises || [])];
      const currentSets = updatedExercises[exIdx].sets || [];
      const lastSet = currentSets[currentSets.length - 1];
      const newSet: WorkoutSet = { reps: lastSet?.reps || 10, weight: lastSet?.weight || 0, type: lastSet?.type || 'normal', completed: false };
      updatedExercises[exIdx] = { ...updatedExercises[exIdx], sets: [...currentSets, newSet] };
      const updatedSession = { ...prev, exercises: updatedExercises };
      storage.setActiveSession(updatedSession);
      return updatedSession;
    });
  }, []);

  const addNewExercise = useCallback(async (ex: Exercise) => {
    const smartGoal = userMissions.find(
      m => m.type === 'smart_goal' && !m.isCompleted && m.smartConfig?.exerciseId === ex.id
    );

    let newSets: WorkoutSet[] = [];
    let notes = '';

    if (smartGoal && smartGoal.smartConfig) {
      const progression = calculateSmartProgression(smartGoal, 0);

      if (progression) {
        newSets = Array(3).fill(null).map(() => ({
          reps: progression.expectedReps,
          weight: progression.expectedValue,
          completed: false,
          type: 'normal'
        }));
        notes = `Anpassat efter mål: ${smartGoal.title.substring(0, 20)}...`;
      }
    }
    
    if (newSets.length === 0) {
      const lastSetData = getLastPerformance(ex.id, history || []);
      newSets = lastSetData && lastSetData.length > 0 
        ? createSmartSets(lastSetData, true, ex) 
        : [{ reps: 10, weight: 0, completed: false, type: 'normal' }, { reps: 10, weight: 0, completed: false, type: 'normal' }, { reps: 10, weight: 0, completed: false, type: 'normal' }];
      notes = lastSetData ? 'Smart laddat från historik' : '';
    }
    
    setLocalSession(prev => {
      if (!prev) return null;
      const newPlannedExercise: PlannedExercise = {
        exerciseId: ex.id,
        sets: newSets,
        notes: notes
      };
      const updatedSession = { ...prev, exercises: [...(prev.exercises || []), newPlannedExercise] };
      storage.setActiveSession(updatedSession);
      return updatedSession;
    });

    setShowAddModal(false);
    const newScore = Math.min(10, (ex.score || 5) + 1);
    await storage.saveExercise({ ...ex, score: newScore });
    onUpdate();
  }, [history, userMissions, onUpdate]);

  const handleGenerateResults = (generated: PlannedExercise[]) => {
     setLocalSession(prev => {
       if (!prev) return null;
       const updatedSession = { ...prev, exercises: [...(prev.exercises || []), ...generated] };
       storage.setActiveSession(updatedSession);
       return updatedSession;
     });
     setShowGenerator(false);
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    setLocalSession(prev => {
      if (!prev) return null;
      const newExercises = [...prev.exercises];
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === newExercises.length - 1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newExercises[index], newExercises[targetIndex]] = [newExercises[targetIndex], newExercises[index]];
      const updated = { ...prev, exercises: newExercises };
      storage.setActiveSession(updated);
      return updated;
    });
  };

  const toggleSupersetWithPrevious = (index: number) => {
    if (index === 0) return;
    setLocalSession(prev => {
      if (!prev) return null;
      const newExercises = [...prev.exercises];
      const current = newExercises[index];
      const previous = newExercises[index - 1];
      if (current.supersetId && current.supersetId === previous.supersetId) {
         newExercises[index] = { ...current, supersetId: undefined };
      } else if (previous.supersetId) {
         newExercises[index] = { ...current, supersetId: previous.supersetId };
      } else {
         const newId = generateId();
         newExercises[index - 1] = { ...previous, supersetId: newId };
         newExercises[index] = { ...current, supersetId: newId };
      }
      const updated = { ...prev, exercises: newExercises };
      storage.setActiveSession(updated);
      return updated;
    });
  };

  const todaysPlans = useMemo(() => {
    const now = new Date();
    const dKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dayOfWeekNum = now.getDay();
    const plansForToday: PlannedActivityForLogDisplay[] = [];
    const recurringPlanIdsAlreadyInstanced: Set<string> = new Set();
    const activePlans = plannedActivities || [];

    activePlans.filter(p => !('isTemplate' in p)).forEach(p => {
      if ((p as ScheduledActivity).date === dKey) {
        plansForToday.push(p);
        if ((p as ScheduledActivity).recurrenceId) {
          recurringPlanIdsAlreadyInstanced.add((p as ScheduledActivity).recurrenceId!);
        }
      }
    });

    activePlans.filter(p => 'isTemplate' in p).forEach(p => {
      const recurringPlan = p as RecurringPlanForDisplay;
      if (recurringPlan.daysOfWeek?.includes(dayOfWeekNum) && !recurringPlanIdsAlreadyInstanced.has(recurringPlan.id)) {
        const planStart = new Date(recurringPlan.startDate);
        planStart.setHours(0,0,0,0);
        const todayAtStart = new Date(now);
        todayAtStart.setHours(0,0,0,0);
        if (planStart <= todayAtStart) {
          plansForToday.push(recurringPlan);
        }
      }
    });
    return plansForToday;
  }, [plannedActivities]);

  const handleUpdateSessionName = useCallback(async (name: string) => {
    if (localSession) {
      const updatedSession = { ...localSession, name };
      setLocalSession(updatedSession);
      storage.setActiveSession(updatedSession);
    }
  }, [localSession]);

  const hasExercises = localSession?.exercises && localSession.exercises.length > 0;
  
  const ActionButtons = (
    <div className="flex gap-2 mx-2 mt-4 mb-4">
      <button onClick={() => setShowGenerator(true)} className="flex-1 py-10 bg-accent-blue/5 border-2 border-dashed border-accent-blue/10 rounded-[40px] flex flex-col items-center justify-center gap-3 text-accent-blue hover:bg-accent-blue/10 transition-all active:scale-95"><Sparkles size={28} /><span className="font-black uppercase tracking-widest text-[9px] italic">Smart PT Generator</span></button>
      <button onClick={() => setShowAddModal(true)} className="flex-1 py-10 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center gap-3 text-text-dim hover:border-accent-pink/30 active:scale-95"><Plus size={28} /><span className="font-black uppercase tracking-widest text-[9px] italic">Lägg till övning</span></button>
    </div>
  );

  if (!localSession) {
    return (
      <div className="pb-32 space-y-8 animate-in fade-in px-4 pt-8 min-h-screen">
        <section className="text-center py-6 space-y-4">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-accent-pink/20 blur-3xl rounded-full animate-pulse" />
            <Dumbbell size={48} className="text-accent-pink relative z-10 mx-auto animate-bounce" style={{ animationDuration: '3s' }} />
          </div>
          <div className="space-y-1">
            <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">Klar för <span className="text-accent-pink">Kamp</span></h2>
            <p className="text-[10px] text-text-dim font-bold uppercase tracking-[0.3em]">Ge allt eller gå hem</p>
          </div>
        </section>
        <section className="space-y-6">
          <button onClick={onStartEmptyWorkout} className="w-full bg-white text-black p-6 rounded-[32px] flex items-center justify-between group active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white"><Play size={24} fill="currentColor" /></div><div className="text-left"><span className="text-[10px] font-black uppercase tracking-widest opacity-60">Snabbstart</span><h3 className="text-xl font-black italic uppercase leading-none">Starta Pass</h3></div></div>
            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </button>
          {todaysPlans.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 px-2"><Calendar size={14} className="text-accent-pink" /><h3 className="text-[10px] font-black uppercase text-text-dim tracking-widest">Dagens Planering</h3></div>
              <div className="grid gap-4">
                {todaysPlans.map(plan => (
                  <button key={plan.id} onClick={() => onStartActivity(plan as ScheduledActivity)} className="bg-[#1a1721] border border-white/5 rounded-[32px] p-6 flex flex-col gap-4 group active:scale-[0.98] transition-all shadow-xl hover:border-accent-pink/20">
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue">{'isTemplate' in plan ? <Repeat size={24} /> : <Calendar size={24} />}</div>
                        <div className="text-left"><h4 className="text-lg font-black italic uppercase text-white leading-tight">{plan.title}</h4><p className="text-[9px] text-text-dim font-bold uppercase tracking-widest">{plan.exercises?.length || 0} övningar • {'isTemplate' in plan ? 'Återkommande' : 'Idag'}</p></div>
                      </div>
                      <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-text-dim group-hover:border-accent-blue group-hover:text-accent-blue transition-colors"><Play size={18} fill="currentColor" /></div>
                    </div>
                    {/* FIX: Replaced truncated text with wrapping pills */}
                    <div className="flex flex-wrap gap-1.5 px-3 py-3 bg-white/5 rounded-2xl border border-white/5">
                      {(plan.exercises || []).slice(0, 8).map((pe, idx) => {
                        const exName = (allExercises || []).find(e => e.id === pe.exerciseId)?.name;
                        if (!exName) return null;
                        return (
                          <span key={idx} className="text-[9px] bg-black/30 text-text-dim px-2 py-1 rounded-md border border-white/5 whitespace-nowrap">
                            {exName}
                          </span>
                        );
                      })}
                      {(plan.exercises?.length || 0) > 8 && (
                        <span className="text-xs text-text-dim self-center">
                          +{(plan.exercises?.length || 0) - 8} mer
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        {todaysPlans.length === 0 && (<div className="pt-4 text-center opacity-10"><p className="text-[8px] font-black uppercase tracking-[0.2em]">Ready for battle</p></div>)}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 pb-64 animate-in fade-in duration-500">
        <WorkoutHeader 
          timer={timer} 
          isTimerActive={isTimerActive} 
          onToggleTimer={() => !isManualMode && setIsTimerActive(!isTimerActive)} 
          onCancel={() => setShowCancelConfirm(true)} 
          onSaveRoutine={async () => {
             const name = window.prompt("Vad ska rutinen heta?", localSession.name);
             if (!name) return;
             await storage.saveRoutine({ id: `routine-${Date.now()}`, name, exercises: (localSession.exercises || []).map(pe => ({ exerciseId: pe.exerciseId, notes: pe.notes, sets: (pe.sets || []).map(s => ({ reps: s.reps, weight: s.weight, type: s.type, completed: false })) })) });
             alert("Rutinen sparad!");
          }} 
          sessionName={localSession.name} 
          onUpdateSessionName={handleUpdateSessionName} 
          isManual={isManualMode}
        />

        <div className="px-4 space-y-4">
          <WorkoutStats 
            session={localSession} 
            allExercises={allExercises} 
            onAddExercise={addNewExercise}
            userProfile={userProfile}
          />
        </div>
        <div className="px-4">
          <button onClick={() => setLocalShowZonePicker(true)} className="w-full py-4 bg-[#1a1721] border border-white/5 rounded-2xl flex items-center justify-between px-6 shadow-sm active:scale-[0.98] transition-all">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white/5 rounded-xl text-accent-blue border border-white/5"><MapPin size={20} /></div>
               <div className="text-left"><span className="text-[9px] font-black uppercase tracking-widest text-text-dim block mb-1">Träningsplats</span><span className="text-lg font-black italic uppercase text-white">{activeZone.name}</span></div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5"><span className="text-[10px] font-bold uppercase text-white/60">Byt</span><RefreshCw size={12} className="text-white/60" /></div>
          </button>
        </div>

        {!hasExercises && ActionButtons}

        <div className="flex flex-col px-2">
          {(localSession.exercises || []).map((item, exIdx) => {
            const exData = (allExercises || []).find(e => e.id === item.exerciseId);
            if (!exData) return null;
            const currentId = item.supersetId;
            const prevId = localSession.exercises[exIdx - 1]?.supersetId;
            const nextId = localSession.exercises[exIdx + 1]?.supersetId;
            const isInSuperset = !!currentId && (currentId === prevId || currentId === nextId);
            const isSupersetStart = isInSuperset && currentId !== prevId;
            const isSupersetEnd = isInSuperset && currentId !== nextId;
            const hasActiveGoal = userMissions.some(m => m.type === 'smart_goal' && !m.isCompleted && m.smartConfig?.exerciseId === item.exerciseId);

            return (
              <div id={`exercise-row-${exIdx}`} key={`${item.exerciseId}-${exIdx}`} className="block mb-2 scroll-mt-24">
                <ExerciseCard 
                  item={item} 
                  exIdx={exIdx} 
                  exData={exData} 
                  userProfile={userProfile} 
                  activeZone={activeZone}
                  isFirst={exIdx === 0}
                  isLast={exIdx === (localSession.exercises.length - 1)}
                  isInSuperset={isInSuperset}
                  isSupersetStart={isSupersetStart}
                  isSupersetEnd={isSupersetEnd}
                  hasActiveGoal={hasActiveGoal}
                  onMoveUp={() => moveExercise(exIdx, 'up')}
                  onMoveDown={() => moveExercise(exIdx, 'down')}
                  onToggleSuperset={() => toggleSupersetWithPrevious(exIdx)}
                  isNotesOpen={openNotesIdx === exIdx} 
                  onToggleNotes={() => setOpenNotesIdx(openNotesIdx === exIdx ? null : exIdx)} 
                  onUpdateNotes={(notes) => updateNotes(exIdx, notes)} 
                  onRemove={() => setExerciseToDelete(exIdx)} 
                  onAddSet={() => addSetToExercise(exIdx)} 
                  onUpdateSet={(setIdx, updates) => updateSet(exIdx, setIdx, updates)} 
                  onShowInfo={() => setInfoModalData({ exercise: exData, index: exIdx })} 
                  isHighlighted={highlightedExIdx === exIdx}
                  onOpenTypeSelector={() => setTypeSelectorData({ exIdx, currentType: item.trackingTypeOverride || exData.trackingType || 'reps_weight'})}
                />
              </div>
            );
          })}
        </div>
        
        {hasExercises && ActionButtons}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[150] pb-safe">
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0f0d15] via-[#0f0d15]/95 to-transparent pointer-events-none" />
        <div className="relative px-6 pb-10 pt-4 max-w-md mx-auto">
          <div className="bg-[#1a1721]/95 backdrop-blur-3xl border border-white/10 rounded-[36px] p-4 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
             {isManualMode ? (
               <button 
                 onClick={() => { if (canFinishWorkout) setShowSummary(true); else setShowNoSetsInfo(true); }}
                 className={`w-full h-16 rounded-[24px] font-black italic text-lg tracking-wider uppercase shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${canFinishWorkout ? 'bg-[#2ed573] text-[#0f0d15]' : 'bg-white/5 text-white/20'}`}
               >
                 Spara Logg <Check size={20} strokeWidth={4} />
               </button>
             ) : (
               <>
                 <div className="flex-1 h-16 relative">
                    {restTimer !== null ? (
                      <button onClick={() => setRestTimer(null)} className="w-full h-full bg-accent-pink rounded-[24px] flex items-center gap-4 px-4 shadow-[0_0_20px_rgba(255,45,85,0.4)] animate-in zoom-in duration-300 active:scale-95 transition-transform"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><RefreshCw size={20} className="animate-spin text-white" /></div><div className="text-left"><span className="text-[8px] font-black uppercase tracking-widest text-white block mb-0.5 opacity-80">VILA</span><span className="text-2xl font-black italic tabular-nums text-white leading-none">{restTimer}s</span></div></button>
                    ) : (
                      <button 
                        onClick={() => setIsTimerActive(!isTimerActive)} 
                        className={`w-full h-full rounded-[24px] flex items-center gap-4 px-4 transition-all active:scale-95 ${timer === 0 && !isTimerActive ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-white/5 border border-white/5'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`}>
                          {isTimerActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </div>
                        <div className="text-left">
                          <span className="text-[8px] font-black uppercase block tracking-[0.2em] mb-0.5">{timer === 0 && !isTimerActive ? 'REDO?' : 'TID'}</span>
                          <span className="text-2xl font-black italic tabular-nums leading-none tracking-tighter">{timer === 0 && !isTimerActive ? 'STARTA PASS' : `${Math.floor(timer/60)}:${String(timer%60).padStart(2,'0')}`}</span>
                        </div>
                      </button>
                    )}
                 </div>
                 <button
                  onClick={() => { if (canFinishWorkout) { setShowSummary(true); } else { setShowNoSetsInfo(true); }}}
                  className={`flex-1 h-16 rounded-[24px] font-black italic text-lg tracking-wider uppercase shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${canFinishWorkout ? 'bg-[#2ed573] text-[#0f0d15] shadow-[0_0_25px_rgba(46,213,115,0.3)]' : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'}`}
                >
                  Slutför <Check size={20} strokeWidth={4} />
                </button>
               </>
             )}
          </div>
        </div>
      </div>

      {showCancelConfirm && (
        <ConfirmModal
          title="Avbryt passet?"
          message="Är du säker på att du vill avsluta? All osparad data för detta pass kommer gå förlorad."
          confirmLabel="Ja, avbryt passet"
          cancelLabel="Nej, fortsätt träna"
          isDestructive={true}
          onConfirm={() => {
            setShowCancelConfirm(false);
            onCancel();
          }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {exerciseToDelete !== null && (
        <ConfirmModal
          title="Ta bort övning?"
          message={`Är du säker på att du vill ta bort "${localSession?.exercises[exerciseToDelete] ? allExercises.find(e => e.id === localSession.exercises[exerciseToDelete].exerciseId)?.name : 'övningen'}" från passet?`}
          confirmLabel="Ja, ta bort"
          cancelLabel="Avbryt"
          isDestructive={true}
          onConfirm={confirmDeleteExercise}
          onCancel={() => setExerciseToDelete(null)}
        />
      )}

      {showSummary && <WorkoutSummaryModal duration={timer} onCancel={() => setShowSummary(false)} onConfirm={(rpe, feeling, finalDuration) => { onComplete({...localSession!, rpe, feeling}, finalDuration); setShowSummary(false); }} />}
      {showGenerator && <WorkoutGenerator activeZone={activeZone} allExercises={allExercises} userProfile={userProfile} history={history} onGenerate={handleGenerateResults} onClose={() => setShowGenerator(false)} />}
      
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0f0d15] z-[9999] flex flex-col animate-in slide-in-from-bottom-10 duration-500 overscroll-y-contain">
          <ExerciseLibrary allExercises={allExercises} history={history} onSelect={addNewExercise} onClose={() => setShowAddModal(false)} onUpdate={onUpdate} activeZone={activeZone} userProfile={userProfile} />
        </div>
      )}

      {localShowZonePicker && (
        <div className="fixed inset-0 bg-[#0f0d15]/95 backdrop-blur-sm z-[9999] flex flex-col p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] animate-in fade-in duration-200">
           <header className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black italic uppercase text-white">Välj Gym</h3><button onClick={() => setLocalShowZonePicker(false)} className="p-3 bg-white/5 rounded-2xl"><X size={24} className="text-white"/></button></header>
           <div className="flex-1 overflow-y-auto space-y-3">{(allZones || []).map(z => {
                 const isActive = activeZone.id === z.id;
                 return (<button key={z.id} onClick={() => { handleSwitchZone(z); setLocalShowZonePicker(false); }} className={`w-full p-5 rounded-3xl border text-left flex items-center justify-between transition-all group ${isActive ? 'bg-white text-black border-white' : 'bg-[#1a1721] border-white/5 text-text-dim'}`}><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isActive ? 'bg-black/10 border-transparent text-black' : 'bg-white/5 border-white/5 text-white'}`}><MapPin size={20} /></div><div><span className="text-lg font-black italic uppercase block leading-none mb-1.5">{z.name}</span><span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-black/60' : 'text-white/30'}`}>{z.inventory?.length || 0} Redskap</span></div></div>{isActive && <div className="bg-black text-white p-2 rounded-full"><Check size={16} strokeWidth={4} /></div>}</button>);
              })}</div>
        </div>
      )}
      {infoModalData && <ExerciseInfoModal 
        exercise={infoModalData.exercise} 
        exIdx={infoModalData.index} 
        onClose={() => setInfoModalData(null)} 
        history={history} 
        onApplyHistory={handleApplyHistory} 
        onExerciseSwap={handleSwapExercise} 
        allExercises={allExercises} 
        onGoToExercise={onGoToExercise} 
        onEditImage={() => {
            if(infoModalData) {
                setImageUploadTarget(infoModalData.exercise);
                setInfoModalData(null);
            }
        }}
      />}

      {showNoSetsInfo && (
        <div className="fixed inset-0 bg-[#0f0d15]/95 backdrop-blur-md z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#1a1721] border border-white/10 rounded-[40px] p-8 max-w-xs w-full text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-accent-pink/10 rounded-3xl flex items-center justify-center mx-auto text-accent-pink border border-accent-pink/20">
              <AlertCircle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black italic uppercase text-white">Inga set klara</h3>
              <p className="text-xs text-text-dim font-medium leading-relaxed">Du måste klarmarkera minst ett set innan du kan slutföra passet. Kämpa på!</p>
            </div>
            <button onClick={() => setShowNoSetsInfo(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black italic uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95">Tillbaka</button>
          </div>
        </div>
      )}

      {typeSelectorData && (
        <TypeSelectorModal
          currentType={typeSelectorData.currentType}
          onClose={() => setTypeSelectorData(null)}
          onSelect={(newType) => handleChangeTrackingType(typeSelectorData.exIdx, newType)}
        />
      )}

      {imageUploadTarget && (
        <div className="fixed inset-0 bg-[#0f0d15] z-[10000] flex flex-col animate-in fade-in">
            <header className="flex justify-between items-center p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
                <h3 className="text-xl font-black italic">Lägg till bild för <span className="text-accent-pink">{imageUploadTarget.name}</span></h3>
                <button onClick={() => setImageUploadTarget(null)} className="p-3 bg-white/5 rounded-2xl text-white"><X size={24}/></button>
            </header>
            <div className="flex-1 flex items-center justify-center p-6">
                <ImageUpload
                    currentImage={imageUploadTarget.image}
                    onImageSaved={handleImageSaved}
                />
            </div>
        </div>
      )}
    </>
  );
};
