
import React, { useState, useMemo, useEffect } from 'react';
import { 
  WorkoutSession, ScheduledActivity, ActivityType, 
  WorkoutRoutine, Exercise, TrackingType, RecurringPlanForDisplay, PlannedActivityForLogDisplay, WorkoutSet 
} from '../types';
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, CheckCircle2,
  Circle, Plus, Dumbbell, History, Repeat, Trash2, X,
  Clock, ChevronDown, ChevronUp, MapPin, TrendingUp, Timer,
  MessageSquare, Activity, Zap, Trophy, CalendarClock, Play, CalendarPlus, List, Calendar as CalendarIcon, ArrowRight, Edit3, Save
} from 'lucide-react';
import { calculate1RM } from '../utils/fitness';
import { ConfirmModal } from './ConfirmModal';
import { CalendarView } from './CalendarView';
import { HistoryItemModal } from './HistoryItemModal';
import { WorkoutDetailsModal } from './WorkoutDetailsModal';
import { registerBackHandler } from '../utils/backHandler';
import { ColorPicker } from './ColorPicker';
import { getColorByHex } from '../utils/colors';
import { ExerciseLibrary } from './ExerciseLibrary';

const formatSeconds = (totalSeconds: number) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const calculatePace = (timeInSeconds: number, distanceInMeters: number) => {
  if (!distanceInMeters || !timeInSeconds) return null;
  const paceInSecondsPerKm = (timeInSeconds / distanceInMeters) * 1000;
  const mins = Math.floor(paceInSecondsPerKm / 60);
  const secs = Math.round(paceInSecondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
};

function getWeekNumber(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil(( ( (date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
}

const LogSetRow: React.FC<{ set: WorkoutSet; type: TrackingType | undefined; isPR: boolean; }> = ({ set, type, isPR }) => {
  const oneRM = (type === 'reps_weight' || !type) ? calculate1RM(set.weight, set.reps) : 0;
  
  const renderTypeBadge = () => {
    switch (set.type) {
      case 'warmup': return <span className="text-[8px] px-1.5 py-0.5 bg-accent-blue/20 text-accent-blue rounded uppercase">W</span>;
      case 'failure': return <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-500 rounded uppercase">F</span>;
      case 'drop': return <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/20 text-orange-500 rounded uppercase">D</span>;
      default: return null; 
    }
  };

  return (
    <div className={`bg-black/20 p-2.5 rounded-xl flex justify-between items-center text-xs font-bold border ${isPR ? 'border-accent-pink/30' : 'border-transparent'}`}>
      <div className="flex items-center gap-2">
        {renderTypeBadge()}
        {isPR && (<div className="flex items-center gap-1 bg-accent-pink/10 text-accent-pink px-1.5 py-0.5 rounded-md"><Trophy size={10} /><span className="text-[8px] uppercase font-black">PR</span></div>)}
      </div>
      <div className="flex items-center gap-4">
        {oneRM > 0 && (<span className="text-accent-blue/60 uppercase text-[9px] font-black">est. 1RM: {oneRM}kg</span>)}
        <div className="text-right">
          {type === 'reps_weight' || !type ? (<span className="text-white">{set.reps} × {set.weight}kg</span>) : 
           type === 'time_distance' ? (<div className="text-right"><span className="text-white">{set.distance}m @ {formatSeconds(set.duration || 0)}</span>{calculatePace(set.duration || 0, set.distance || 0) && (<p className="text-[8px] text-accent-blue uppercase font-black">{calculatePace(set.duration || 0, set.distance || 0)}</p>)}</div>) : 
           type === 'time_only' ? (<span className="text-white">{formatSeconds(set.duration || 0)}</span>) : 
           (<span className="text-white">{set.reps} reps</span>)}
        </div>
      </div>
    </div>
  );
};

interface WorkoutLogProps {
  history: WorkoutSession[];
  plannedActivities: PlannedActivityForLogDisplay[];
  routines: WorkoutRoutine[];
  allExercises: Exercise[];
  onAddPlan: (activity: ScheduledActivity, isRecurring: boolean, days?: number[]) => void;
  onDeletePlan: (id: string, isTemplate: boolean) => void;
  onDeleteHistory: (id: string) => void;
  onMovePlan: (id: string, newDate: string) => void;
  onMoveRecurringInstance: (templateId: string, currentDate: string, newDate: string) => void;
  onSkipRecurringInstance: (templateId: string, date: string) => void;
  onUpdateScheduledActivity: (id: string, updates: Partial<ScheduledActivity>) => void;
  onUpdateRecurringPlan: (id: string, updates: Partial<RecurringPlan>) => void;
  onStartActivity: (activity: ScheduledActivity) => void;
  onStartManualWorkout: (date: string) => void;
  onStartLiveWorkout: () => void;
  onUpdate: () => void;
}

export const WorkoutLog: React.FC<WorkoutLogProps> = ({
  history, plannedActivities, routines, allExercises,
  onAddPlan, onDeletePlan, onDeleteHistory, onMovePlan, onMoveRecurringInstance, onSkipRecurringInstance,
  onUpdateScheduledActivity, onUpdateRecurringPlan,
  onStartActivity, onStartManualWorkout, onStartLiveWorkout, onUpdate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [confirmDelete, setConfirmDelete] = useState<{id: string, isHistory: boolean, isTemplate: boolean} | null>(null);
  
  // State för att flytta pass
  const [moveModalData, setMoveModalData] = useState<{id: string, title: string, currentDate: string, isTemplate?: boolean} | null>(null);
  const [customMoveDate, setCustomMoveDate] = useState('');

  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planColor, setPlanColor] = useState('#1a1721'); // Färg för passet

  // State för att skapa eget pass
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customExercises, setCustomExercises] = useState<PlannedExercise[]>([]);
  const [showExerciseLibraryForCustom, setShowExerciseLibraryForCustom] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null); // ID på pass som redigeras
  const [editingIsTemplate, setEditingIsTemplate] = useState(false); // Om det är recurring eller scheduled

  // State för expanded planerat pass
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planPressTimer, setPlanPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showColorPickerForPlan, setShowColorPickerForPlan] = useState<string | null>(null);

  // State för swipe-funktionalitet
  const [swipeState, setSwipeState] = useState<{ id: string; x: number; direction: 'left' | 'right' | null } | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);

  // Optimistiska uppdateringar
  const [deletedPlanIds, setDeletedPlanIds] = useState<Set<string>>(new Set());
  const [updatedPlans, setUpdatedPlans] = useState<Map<string, Partial<PlannedActivityForLogDisplay>>>(new Map());

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedItem, setSelectedItem] = useState<WorkoutSession | PlannedActivityForLogDisplay | null>(null);
  
  useEffect(() => {
    if (selectedItem || showDatePicker || showPlanModal || confirmDelete || moveModalData) {
      return registerBackHandler(() => {
        setSelectedItem(null);
        setShowDatePicker(false);
        setShowPlanModal(false);
        setConfirmDelete(null);
        setMoveModalData(null);
      });
    }
  }, [selectedItem, showDatePicker, showPlanModal, confirmDelete, moveModalData]);

  // Blockera scrollning när modal är öppen
  useEffect(() => {
    if (showPlanModal || showDatePicker || moveModalData || showCreateCustom) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [showPlanModal, showDatePicker, moveModalData, showCreateCustom]);

  // Applicera optimistiska uppdateringar på planned activities
  const optimisticPlannedActivities = useMemo(() => {
    return plannedActivities
      .filter(p => !deletedPlanIds.has(p.id)) // Filtrera bort raderade
      .map(p => {
        const updates = updatedPlans.get(p.id);
        return updates ? { ...p, ...updates } : p; // Applicera uppdateringar
      });
  }, [plannedActivities, deletedPlanIds, updatedPlans]);

  const weekdays = [ { id: 1, label: 'Mån' }, { id: 2, label: 'Tis' }, { id: 3, label: 'Ons' }, { id: 4, label: 'Tor' }, { id: 5, label: 'Fre' }, { id: 6, label: 'Lör' }, { id: 0, label: 'Sön' } ];

  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return day;
    });
  }, [currentDate]);

  const checkIsPR = (exerciseId: string, weight: number, reps: number, sessionDate: string) => {
    const current1RM = calculate1RM(weight, reps);
    if (current1RM === 0) return false;
    const earlierHistory = history.filter((h: any) => new Date(h.date) < new Date(sessionDate));
    for (const session of earlierHistory) {
      const ex = session.exercises.find((e: any) => e.exerciseId === exerciseId);
      if (ex) {
        for (const set of ex.sets) {
          if (calculate1RM(set.weight || 0, set.reps || 0) >= current1RM) return false;
        }
      }
    }
    return true;
  };

  const toggleDay = (dayId: number) => { setSelectedDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]); };

  // Long-press handlers för planerade pass
  const handlePlanPressStart = (planId: string) => {
    const timer = setTimeout(() => {
      setExpandedPlanId(planId);
      setPlanPressTimer(null);
    }, 600); // 600ms long-press
    setPlanPressTimer(timer);
  };

  const handlePlanPressEnd = () => {
    if (planPressTimer) {
      clearTimeout(planPressTimer);
      setPlanPressTimer(null);
    }
  };

  // Swipe handlers
  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent, planId: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setSwipeStartX(clientX);
    setSwipeState({ id: planId, x: 0, direction: null });
  };

  const handleSwipeMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (swipeStartX === null || !swipeState) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - swipeStartX;

    // Tillåt bara swipe höger (+) eller vänster (-)
    if (Math.abs(deltaX) > 10) {
      const direction = deltaX > 0 ? 'right' : 'left';
      setSwipeState({ ...swipeState, x: deltaX, direction });
    }
  };

  const handleSwipeEnd = async (p: PlannedActivityForLogDisplay, dKey: string) => {
    if (!swipeState || Math.abs(swipeState.x) < 80) {
      // Återställ om swipe var för kort
      setSwipeState(null);
      setSwipeStartX(null);
      return;
    }

    const isTemplate = 'isTemplate' in p;

    if (swipeState.direction === 'right') {
      // Swipe höger → Starta pass
      // Animera ut helt först
      setSwipeState({ ...swipeState, x: 500 });

      // Vänta på animation
      setTimeout(async () => {
        if (isTemplate) {
          const activityId = `recurring-start-${Date.now()}`;
          const concreteActivity: ScheduledActivity = {
            id: activityId,
            date: dKey,
            type: p.type,
            title: p.title,
            isCompleted: false,
            exercises: p.exercises || [],
            recurrenceId: p.id,
            color: p.color
          };
          await onAddPlan(concreteActivity, false);
          onStartActivity(concreteActivity);
        } else {
          onStartActivity(p as ScheduledActivity);
        }

        setSwipeState(null);
        setSwipeStartX(null);
      }, 200);

    } else if (swipeState.direction === 'left') {
      // Swipe vänster → Öppna flytt-modal
      setSwipeState(null);
      setSwipeStartX(null);
      setCustomMoveDate(isTemplate ? dKey : p.date);
      setMoveModalData({
        id: p.id,
        title: p.title,
        currentDate: isTemplate ? dKey : p.date,
        isTemplate: isTemplate
      });
    }
  };

  const handleUpdatePlanColor = async (planId: string, newColor: string, isTemplate: boolean) => {
    // Optimistisk uppdatering - uppdatera UI direkt
    setUpdatedPlans(prev => new Map(prev).set(planId, { color: newColor }));
    setShowColorPickerForPlan(null);

    // Gör riktig uppdatering i bakgrunden och vänta på att den blir klar
    try {
      if (isTemplate) {
        await onUpdateRecurringPlan(planId, { color: newColor });
      } else {
        await onUpdateScheduledActivity(planId, { color: newColor });
      }
      // Refresh data från backend EFTER att uppdateringen är klar
      await onUpdate();

      // Rensa optimistisk uppdatering när backend-data är uppdaterad
      setUpdatedPlans(prev => {
        const newMap = new Map(prev);
        newMap.delete(planId);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to update color:', error);
      // Återställ optimistisk uppdatering om det misslyckades
      setUpdatedPlans(prev => {
        const newMap = new Map(prev);
        newMap.delete(planId);
        return newMap;
      });
    }
  };

  const handleSavePlan = () => {
    const routine = routines.find(r => r.id === selectedRoutineId);
    const finalTitle = planTitle || routine?.name || 'Nytt Pass';
    const activity: ScheduledActivity = {
      id: `plan-${Date.now()}`,
      date: planDate,
      type: 'gym',
      title: finalTitle,
      isCompleted: false,
      exercises: routine?.exercises || [],
      color: planColor
    };
    onAddPlan(activity, isRecurring, selectedDays);
    setShowPlanModal(false);
    setPlanTitle('');
    setSelectedRoutineId('');
    setIsRecurring(false);
    setSelectedDays([]);
    setPlanColor('#1a1721');
  };

  const handleSaveCustomPlan = () => {
    if (!planTitle.trim()) {
      alert('Ange ett namn på passet');
      return;
    }
    if (customExercises.length === 0) {
      alert('Lägg till minst en övning');
      return;
    }

    // Om vi redigerar ett befintligt pass
    if (editingPlanId) {
      if (editingIsTemplate) {
        // Uppdatera recurring plan
        onUpdateRecurringPlan(editingPlanId, {
          title: planTitle,
          exercises: customExercises,
          color: planColor,
          daysOfWeek: selectedDays
        });
      } else {
        // Uppdatera scheduled activity
        onUpdateScheduledActivity(editingPlanId, {
          title: planTitle,
          exercises: customExercises,
          color: planColor,
          date: planDate
        });
      }
    } else {
      // Skapa nytt pass
      const activity: ScheduledActivity = {
        id: `plan-${Date.now()}`,
        date: planDate,
        type: 'gym',
        title: planTitle,
        isCompleted: false,
        exercises: customExercises,
        color: planColor
      };
      onAddPlan(activity, isRecurring, selectedDays);
    }

    // Rensa alla states
    setShowCreateCustom(false);
    setPlanTitle('');
    setCustomExercises([]);
    setIsRecurring(false);
    setSelectedDays([]);
    setPlanColor('#1a1721');
    setEditingPlanId(null);
    setEditingIsTemplate(false);
  };

  const handleFinalSavePlan = () => {
    const activity: ScheduledActivity = {
      id: `plan-${Date.now()}`,
      date: planDate,
      type: 'gym',
      title: planTitle,
      isCompleted: false,
      exercises: customExercises,
      color: planColor
    };
    onAddPlan(activity, isRecurring, selectedDays);
    setShowPlanModal(false);
    setPlanTitle('');
    setCustomExercises([]);
    setIsRecurring(false);
    setSelectedDays([]);
    setPlanColor('#1a1721');
  };

  const handleAddExerciseToCustom = (ex: Exercise) => {
    const newPlanned: PlannedExercise = {
      exerciseId: ex.id,
      sets: [
        { reps: 10, weight: 0, completed: false, type: 'normal' },
        { reps: 10, weight: 0, completed: false, type: 'normal' },
        { reps: 10, weight: 0, completed: false, type: 'normal' }
      ],
      notes: ''
    };
    setCustomExercises([...customExercises, newPlanned]);
  };

  const handleRemoveCustomExercise = (index: number) => {
    const updated = [...customExercises];
    updated.splice(index, 1);
    setCustomExercises(updated);
  };

  const updateCustomSet = (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: number) => {
    const updated = [...customExercises];
    const updatedSets = [...updated[exIdx].sets];
    updatedSets[setIdx] = { ...updatedSets[setIdx], [field]: value };
    updated[exIdx] = { ...updated[exIdx], sets: updatedSets };
    setCustomExercises(updated);
  };

  const addCustomSet = (exIdx: number) => {
    const updated = [...customExercises];
    const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1];
    updated[exIdx].sets.push({ ...lastSet, completed: false });
    setCustomExercises(updated);
  };

  const removeCustomSet = (exIdx: number, setIdx: number) => {
    const updated = [...customExercises];
    if (updated[exIdx].sets.length > 1) {
      updated[exIdx].sets.splice(setIdx, 1);
      setCustomExercises(updated);
    }
  };

  const handleExecuteMove = (targetDate: string) => {
    if (moveModalData) {
        if (moveModalData.isTemplate) {
            // Flytta enskild instans av recurring plan
            onMoveRecurringInstance(moveModalData.id, moveModalData.currentDate, targetDate);
        } else {
            // Flytta konkret planerad aktivitet
            onMovePlan(moveModalData.id, targetDate);
        }
        setMoveModalData(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete) {
      const idToDelete = confirmDelete.id;
      const isHistory = confirmDelete.isHistory;

      if (!isHistory) {
        // Optimistisk uppdatering - ta bort från UI direkt
        setDeletedPlanIds(prev => new Set(prev).add(idToDelete));
      }

      // Gör riktig borttagning och vänta
      try {
        if (isHistory) {
          await onDeleteHistory(idToDelete);
        } else {
          await onDeletePlan(idToDelete, confirmDelete.isTemplate);
        }
        await onUpdate();

        // Rensa optimistisk uppdatering efter backend är klar
        if (!isHistory) {
          setDeletedPlanIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(idToDelete);
            return newSet;
          });
        }
      } catch (error) {
        console.error('Failed to delete:', error);
        // Återställ om det misslyckades
        if (!isHistory) {
          setDeletedPlanIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(idToDelete);
            return newSet;
          });
        }
      } finally {
        setConfirmDelete(null);
      }
    }
  };
  const handleStartManual = () => { onStartManualWorkout(manualDate); setShowDatePicker(false); };

  const isHistoryItem = (item: any): item is WorkoutSession => 'zoneId' in item;

  return (
    <div className="pb-32 space-y-6 animate-in fade-in">
      <div className="px-4 pt-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Logg & Plan</h2>
          <p className="text-[10px] text-text-dim font-bold uppercase tracking-[0.2em]">{viewMode === 'list' ? `Vecka ${getWeekNumber(currentDate)}` : 'Månadsöversikt'}</p>
        </div>
        <div className="flex gap-2 items-center">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-text-dim'}`}><List size={20}/></button>
              <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-text-dim'}`}><CalendarIcon size={20}/></button>
            </div>
            <button onClick={() => { setPlanDate(new Date().toISOString().split('T')[0]); setShowPlanModal(true); }} className="bg-white/5 border border-white/10 text-white p-3 rounded-2xl shadow-xl active:scale-90 transition-transform">
              <Plus size={24} strokeWidth={3} />
            </button>
        </div>
      </div>

      <div className="px-4 grid grid-cols-2 gap-3">
         <button onClick={onStartLiveWorkout} className="bg-white text-black py-4 rounded-2xl font-black italic uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Play size={20} fill="currentColor" /> Starta Nu</button>
         <button onClick={() => setShowDatePicker(true)} className="bg-[#1a1721] text-white border border-white/10 py-4 rounded-2xl font-black italic uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><CalendarPlus size={20} /> Efterregistrera</button>
      </div>

      {viewMode === 'list' && (
        <div className="animate-in fade-in">
            <div className="flex items-center justify-between mx-4 bg-[#1a1721] p-2 rounded-2xl border border-white/5 shadow-lg">
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-3 text-text-dim hover:text-white transition-colors shrink-0"><ChevronLeft size={20} /></button>
                <div className="flex flex-1 justify-around items-center px-1 min-w-0 overflow-hidden">
                {weekDays.map(d => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                    <div key={d.toString()} className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all ${isToday ? 'bg-accent-pink text-white shadow-md shadow-accent-pink/20 scale-110' : 'text-text-dim'}`} style={{ width: 'calc(100% / 7)', maxWidth: '45px' }}>
                        <span className="text-[7px] font-black uppercase opacity-60 leading-none mb-1">{d.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '').slice(0, 3)}</span>
                        <span className="text-xs font-black leading-none">{d.getDate()}</span>
                    </div>
                    );
                })}
                </div>
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-3 text-text-dim hover:text-white transition-colors shrink-0"><ChevronRight size={20} /></button>
            </div>
            <div className="px-4 space-y-6 mt-6">
            {weekDays.map(day => {
                const dKey = day.toISOString().split('T')[0];
                const isToday = dKey === new Date().toISOString().split('T')[0];
                const dayOfWeekNum = day.getDay();
                const dayHistory = history.filter(h => h.date.startsWith(dKey));
                
                const dayPlans = optimisticPlannedActivities.filter(p => {
                    if ('isTemplate' in p) {
                        const isScheduledForDay = p.daysOfWeek?.includes(dayOfWeekNum);
                        if (!isScheduledForDay) return false;

                        // Kolla om det finns EN KONKRET instans (även skippade/completed) för denna dag
                        const hasConcreteInstance = optimisticPlannedActivities.some((otherP) =>
                            !('isTemplate' in otherP) &&
                            (otherP as ScheduledActivity).recurrenceId === p.id &&
                            otherP.date === dKey
                            // Vi kollar INTE isCompleted här - även skippade räknas som konkreta instanser
                        );

                        return isScheduledForDay && !hasConcreteInstance;
                    } else {
                        // Visa bara OFÄRDIGA konkreta planerade pass
                        return p.date === dKey && !p.isCompleted;
                    }
                });

                return (<div key={dKey} className="space-y-3"><div className="flex items-center gap-3 px-2"><div className={`h-[1px] flex-1 ${isToday ? 'bg-accent-pink/30' : 'bg-white/5'}`} /><h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-accent-pink' : 'text-text-dim'}`}>{day.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</h4><div className={`h-[1px] flex-1 ${isToday ? 'bg-accent-pink/30' : 'bg-white/5'}`} /></div>
                {dayPlans.map(p => {
                  const isTemplate = 'isTemplate' in p;
                  const cardBg = p.color || '#1a1721';
                  const isBrightColor = cardBg !== '#1a1721' && cardBg !== '#000000';
                  const isExpanded = expandedPlanId === p.id;
                  const isSwiping = swipeState?.id === p.id;
                  const swipeX = isSwiping ? swipeState.x : 0;
                  const showRightIcon = isSwiping && swipeX > 20;
                  const showLeftIcon = isSwiping && swipeX < -20;

                  return (
                    <div key={p.id} className="relative">
                      {/* Bakgrundsikoner */}
                      {showRightIcon && (
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-0">
                          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                            <Play size={24} fill="white" className="text-white" />
                          </div>
                        </div>
                      )}
                      {showLeftIcon && (
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none z-0">
                          <div className="w-12 h-12 bg-accent-blue rounded-xl flex items-center justify-center shadow-lg">
                            <CalendarClock size={24} className="text-white" />
                          </div>
                        </div>
                      )}

                      {/* Själva kortet */}
                      <div
                        onMouseDown={(e) => {
                          handleSwipeStart(e, p.id);
                          handlePlanPressStart(p.id);
                        }}
                        onMouseMove={handleSwipeMove}
                        onMouseUp={() => {
                          handlePlanPressEnd();
                          handleSwipeEnd(p, dKey);
                        }}
                        onMouseLeave={() => {
                          handlePlanPressEnd();
                          setSwipeState(null);
                          setSwipeStartX(null);
                        }}
                        onTouchStart={(e) => {
                          handleSwipeStart(e, p.id);
                          handlePlanPressStart(p.id);
                        }}
                        onTouchMove={handleSwipeMove}
                        onTouchEnd={() => {
                          handlePlanPressEnd();
                          handleSwipeEnd(p, dKey);
                        }}
                        className="rounded-[28px] p-4 group animate-in zoom-in-95 border transition-all relative z-10"
                        style={{
                          backgroundColor: cardBg,
                          borderColor: isBrightColor ? 'transparent' : 'rgba(255,255,255,0.1)',
                          transform: `translateX(${swipeX}px)`,
                          transition: isSwiping && Math.abs(swipeX) < 80 ? 'none' : 'transform 0.2s ease-out'
                        }}
                      >
                      {/* Normal view */}
                      {!isExpanded && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                              {isTemplate ? <Repeat size={18} /> : <CalIcon size={18} />}
                            </div>
                            <div>
                              <p className="text-xs font-black text-white uppercase italic leading-none mb-1">{p.title}</p>
                              <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                                {isTemplate ? 'Återkommande' : 'Planerat'} • {p.exercises?.length || 0} övningar
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            if (isTemplate) {
                              // För recurring templates: skapa en konkret aktivitet med unikt ID
                              const activityId = `recurring-start-${Date.now()}`;
                              const concreteActivity: ScheduledActivity = {
                                id: activityId,
                                date: dKey,
                                type: p.type,
                                title: p.title,
                                isCompleted: false,
                                exercises: p.exercises || [],
                                recurrenceId: p.id,
                                color: p.color // Ärv färgen från återkommande planen
                              };
                              // Spara aktiviteten först så att mallen döljs OCH så att den finns med sourceActivityId
                              await onAddPlan(concreteActivity, false);
                              // Starta passet med samma aktivitet (samma ID = sourceActivityId kommer matcha)
                              onStartActivity(concreteActivity);
                            } else {
                              // För konkreta planerade pass: starta direkt
                              onStartActivity(p as ScheduledActivity);
                            }
                          }}
                          className="w-10 h-10 bg-accent-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent-blue/20 active:scale-90 transition-transform"
                        >
                          <Play size={18} fill="currentColor" />
                        </button>
                        <button
                          onClick={() => {
                            setCustomMoveDate(isTemplate ? dKey : p.date);
                            setMoveModalData({
                              id: p.id,
                              title: p.title,
                              currentDate: isTemplate ? dKey : p.date,
                              isTemplate: isTemplate
                            });
                          }}
                          className="p-2.5 text-text-dim hover:text-white transition-colors"
                        >
                          <CalendarClock size={18} />
                        </button>
                        {isTemplate ? (
                          <div className="relative group/delete">
                            <button
                              onClick={() => onSkipRecurringInstance(p.id, dKey)}
                              className="p-2.5 text-text-dim hover:text-red-500 transition-colors"
                              title="Radera denna instans"
                            >
                              <Trash2 size={18} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ id: p.id, isHistory: false, isTemplate: true })}
                              className="p-2.5 text-text-dim hover:text-red-500 transition-colors border-l border-white/10"
                              title="Radera ALLA återkommande"
                            >
                              <X size={18} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete({ id: p.id, isHistory: false, isTemplate: false })}
                            className="p-2.5 text-text-dim hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                          </div>
                        </div>
                      )}

                      {/* Expanded view */}
                      {isExpanded && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                                {isTemplate ? <Repeat size={18} /> : <CalIcon size={18} />}
                              </div>
                              <div>
                                <p className="text-xs font-black text-white uppercase italic leading-none mb-1">{p.title}</p>
                                <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                                  {isTemplate ? 'Återkommande' : 'Planerat'} • {p.exercises?.length || 0} övningar
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setExpandedPlanId(null)}
                              className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowColorPickerForPlan(p.id)}
                              className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                              <div className="w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: p.color || '#1a1721' }} />
                              Ändra Färg
                            </button>
                            <button
                              onClick={() => {
                                // Ladda in passets övningar och öppna redigera-vyn
                                setEditingPlanId(p.id);
                                setEditingIsTemplate(isTemplate);
                                setPlanTitle(p.title);
                                setCustomExercises(p.exercises || []);
                                setPlanColor(p.color || '#1a1721');
                                setPlanDate(isTemplate ? dKey : p.date);
                                setIsRecurring(isTemplate);
                                if (isTemplate) {
                                  setSelectedDays((p as RecurringPlanForDisplay).daysOfWeek);
                                }
                                // Stäng expand och öppna edit-vyn
                                setExpandedPlanId(null);
                                setShowCreateCustom(true);
                              }}
                              className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                              <Edit3 size={14} />
                              Ändra Pass
                            </button>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
                {dayHistory.map(session => {
                  const startTime = new Date(session.date);
                  const endTime = session.duration ? new Date(startTime.getTime() + session.duration * 1000) : null;
                  const timeString = startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={session.id} className="bg-[#1a1721] rounded-[32px] border border-white/5 overflow-hidden transition-all shadow-xl">
                      <div onClick={() => setExpandedId(expandedId === session.id ? null : session.id)} className="p-5 flex justify-between items-center cursor-pointer active:bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black italic uppercase text-white leading-tight mb-1">{session.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[9px] text-green-500/70 font-black uppercase tracking-widest">Klar {timeString}</span>
                              <span className="text-[9px] text-text-dim font-bold uppercase tracking-widest">• {Math.round((session.duration || 0)/60)} min</span>
                              {session.isManual && (
                                <span className="text-[9px] text-text-dim font-bold uppercase tracking-widest">• Efterhand</span>
                              )}
                              {session.locationName && (
                                <span className="text-[9px] text-accent-blue font-black uppercase tracking-widest flex items-center gap-1 bg-accent-blue/5 px-2 py-0.5 rounded-full border border-accent-blue/10">
                                  <MapPin size={8} /> {session.locationName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-text-dim">{expandedId === session.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                      </div>
                      {expandedId === session.id && (
                        <div className="px-5 pb-5 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                          {(session.feeling || session.rpe) && (
                            <div className="flex flex-wrap gap-4 my-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                              {session.feeling && (<div className="flex items-center gap-2"><Activity size={14} className="text-accent-pink" /><span className="text-[10px] font-black uppercase text-white tracking-widest">{session.feeling}</span></div>)}
                              {session.rpe && (<div className="flex items-center gap-2"><Zap size={14} className="text-accent-blue" /><span className="text-[10px] font-black uppercase text-white tracking-widest">Ansträngning: {session.rpe}/10</span></div>)}
                            </div>
                          )}
                          <div className="py-4 space-y-6">{session.exercises.map((ex, idx) => {const exData = allExercises.find(e => e.id === ex.exerciseId); return (<div key={idx} className="space-y-3"><div className="flex justify-between items-baseline gap-4"><span className="text-xs font-black uppercase italic text-accent-pink tracking-tight shrink-0">{exData?.name || 'Övning'}</span>{ex.notes && (<div className="flex items-center gap-1.5 opacity-60 min-w-0 text-right"><MessageSquare size={10} className="text-text-dim shrink-0" /><span className="text-[9px] font-bold text-text-dim italic truncate">{ex.notes}</span></div>)}</div><div className="space-y-1.5">{ex.sets.filter(s => s.completed).map((set, sIdx) => (<LogSetRow key={sIdx} set={set} type={ex.trackingTypeOverride || exData?.trackingType} isPR={checkIsPR(ex.exerciseId, set.weight, set.reps, session.date)} />))}</div></div>);})}{' '}</div>
                          <div className="pt-2 border-t border-white/5"><button onClick={(e) => { e.stopPropagation(); setConfirmDelete({id: session.id, isHistory: true, isTemplate: false}); }} className="w-full py-3 text-red-500/50 hover:text-red-500 text-[9px] font-black uppercase tracking-[0.2em] transition-colors">Radera Pass Permanent</button></div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {dayPlans.length === 0 && dayHistory.length === 0 && (<button onClick={() => { setPlanDate(dKey); setShowPlanModal(true); }} className="w-full py-4 border-2 border-dashed border-white/5 rounded-[28px] flex items-center justify-center gap-2 text-text-dim/20 hover:text-text-dim/50 hover:border-white/10 transition-all group"><Plus size={16} className="group-hover:scale-125 transition-transform" /><span className="text-[10px] font-black uppercase tracking-widest">Planera pass</span></button>)}</div>);
            })}
            </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="px-4 animate-in fade-in">
          <CalendarView
            history={history}
            plannedActivities={optimisticPlannedActivities}
            allExercises={allExercises}
            onDayClick={setSelectedItem}
            onStartPlanned={onStartActivity}
            onAddPlan={onAddPlan}
          />
        </div>
      )}

      {showDatePicker && (<div className="fixed inset-0 bg-[#0f0d15]/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300"><div className="bg-[#1a1721] border border-white/10 rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95"><button onClick={() => setShowDatePicker(false)} className="absolute top-6 right-6 p-2 text-white/30 hover:text-white"><X size={20}/></button><div className="flex flex-col items-center text-center mb-8"><div className="w-16 h-16 bg-accent-blue/10 rounded-2xl flex items-center justify-center text-accent-blue mb-4"><CalendarPlus size={32} /></div><h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Välj Datum</h3><p className="text-xs text-text-dim mt-1">När utfördes träningen?</p></div><input type="date" value={manualDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setManualDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-center outline-none mb-8 focus:border-accent-blue" /><button onClick={handleStartManual} className="w-full py-5 bg-accent-blue text-white rounded-[24px] font-black italic text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all">Logga detta datum</button></div></div>)}
      {showPlanModal && (<div className="fixed inset-0 z-[105] bg-[#0f0d15] flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-hidden"><div className="absolute inset-0" onClick={() => setShowPlanModal(false)} /><div className="relative bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Planera</h3><button onClick={() => { setShowPlanModal(false); if (customExercises.length === 0) { setPlanTitle(''); setPlanColor('#1a1721'); } }} className="p-2 bg-white/5 rounded-full text-text-dim hover:text-white transition-colors"><X size={20} /></button></div><div className="space-y-5">{customExercises.length === 0 ? (<><div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Välj Rutin</label><select value={selectedRoutineId} onChange={e => setSelectedRoutineId(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue/50"><option value="">-- Välj rutin --</option>{routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>{!selectedRoutineId && (<div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Namn på passet (valfritt)</label><input placeholder="t.ex. Löpning..." value={planTitle} onChange={e => setPlanTitle(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue/50" /></div>)}{selectedRoutineId && (<div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Namn (valfritt)</label><input placeholder="Skriv över rutinens namn..." value={planTitle} onChange={e => setPlanTitle(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue/50" /></div>)}</>) : (<div className="bg-white/5 border border-white/10 rounded-2xl p-4"><div className="flex justify-between items-center mb-2"><p className="text-sm font-black uppercase text-white">{planTitle}</p><button onClick={() => {
                  setShowPlanModal(false);
                  setTimeout(() => setShowCreateCustom(true), 100);
                }} className="text-accent-blue text-xs font-bold uppercase"><Edit3 size={14} className="inline mr-1" />Redigera</button></div><p className="text-[10px] text-text-dim uppercase tracking-widest">{customExercises.length} övningar</p></div>)}<ColorPicker selectedColor={planColor} onSelectColor={setPlanColor} /><div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-3"><Repeat size={18} className={isRecurring ? "text-accent-blue" : "text-text-dim"} /><span className="text-xs font-black uppercase text-white tracking-widest">Återkommande</span></div><button onClick={() => setIsRecurring(!isRecurring)} className={`w-12 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-accent-blue' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isRecurring ? 'right-1' : 'left-1'}`} /></button></div>{isRecurring ? (<div className="flex justify-between gap-1">{weekdays.map(day => (<button key={day.id} onClick={() => toggleDay(day.id)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedDays.includes(day.id) ? 'bg-accent-blue border-accent-blue text-white' : 'bg-black/40 border-white/5 text-text-dim'}`}>{day.label}</button>))}</div>) : (<div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Datum</label><input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" /></div>)}{customExercises.length === 0 && (<><div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div><div className="relative flex justify-center text-[10px] font-black uppercase"><span className="bg-[#1a1721] px-2 text-text-dim">Eller</span></div></div><button onClick={() => {
                setShowPlanModal(false);
                setTimeout(() => setShowCreateCustom(true), 100);
              }} className="w-full py-4 bg-accent-pink/10 border border-accent-pink/30 text-accent-pink rounded-2xl font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><Plus size={20} /> Skapa nytt pass</button></>)}<button onClick={customExercises.length > 0 ? handleFinalSavePlan : handleSavePlan} className="w-full py-5 bg-white text-black rounded-3xl font-black italic uppercase tracking-widest shadow-xl active:scale-95 transition-transform mt-2">Spara Plan</button></div></div></div>)}

      {moveModalData && (
        <div className="fixed inset-0 z-[200] bg-[#0f0d15]/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl p-8 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Flytta Pass</h3>
                        <p className="text-xs text-text-dim truncate max-w-[200px]">{moveModalData.title}</p>
                    </div>
                    <button onClick={() => setMoveModalData(null)} className="p-3 bg-white/5 rounded-2xl hover:text-white text-text-dim transition-colors"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {(() => {
                        const today = new Date(moveModalData.currentDate);
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const tomorrowStr = tomorrow.toISOString().split('T')[0];
                        
                        return (
                            <button 
                                onClick={() => handleExecuteMove(tomorrowStr)}
                                className="w-full py-6 bg-green-500 text-white rounded-[24px] font-black uppercase text-lg tracking-widest shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition-all hover:bg-green-400"
                            >
                                <span className="flex items-center gap-2"><ArrowRight size={20} strokeWidth={3} /> Imorgon</span>
                                <span className="text-[10px] opacity-80 font-bold">{tomorrow.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                            </button>
                        );
                    })()}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase">
                            <span className="bg-[#1a1721] px-2 text-text-dim">Eller</span>
                        </div>
                    </div>

                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                        <label className="text-[10px] font-black uppercase text-text-dim tracking-widest block mb-2">Välj eget datum</label>
                        <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={customMoveDate}
                                onChange={(e) => setCustomMoveDate(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-accent-blue text-sm"
                            />
                            <button 
                                onClick={() => handleExecuteMove(customMoveDate)}
                                className="px-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold transition-all"
                            >
                                <CheckCircle2 size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showCreateCustom && !showExerciseLibraryForCustom && (
        <div className="fixed inset-0 z-[110] bg-[#0f0d15] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          <div className="p-4 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-white/10 flex justify-between items-center bg-[#1a1721] sticky top-0 z-10">
            <div>
              <h3 className="text-xl font-black italic uppercase text-white">{editingPlanId ? 'Redigera Pass' : 'Skapa Pass'}</h3>
              <p className="text-[10px] text-text-dim uppercase tracking-widest">{editingPlanId ? 'Uppdatera övningar' : 'Bygg ditt pass'}</p>
            </div>
            <button onClick={() => {
              setShowCreateCustom(false);
              // Rensa bara om det inte fanns något
              if (customExercises.length === 0) {
                setPlanTitle('');
                setPlanColor('#1a1721');
                setIsRecurring(false);
                setSelectedDays([]);
              }
              setEditingPlanId(null);
              setEditingIsTemplate(false);
            }} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="text-xs font-bold text-text-dim uppercase mb-2 block">Namn på passet</label>
              <input
                type="text"
                placeholder="T.ex. Push Day"
                value={planTitle}
                onChange={e => setPlanTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-bold outline-none focus:border-accent-pink"
              />
            </div>

            <div className="space-y-4">
              {customExercises.map((item, exIdx) => {
                const exData = allExercises.find(e => e.id === item.exerciseId);
                if (!exData) return null;

                return (
                  <div key={`${item.exerciseId}-${exIdx}`} className="bg-[#1a1721] border border-white/5 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="min-w-0">
                        <h4 className="text-lg font-black italic uppercase text-white truncate">{exData.name}</h4>
                        {exData.englishName && <p className="text-xs text-white/40 italic truncate">{exData.englishName}</p>}
                      </div>
                      <button onClick={() => handleRemoveCustomExercise(exIdx)} className="text-text-dim hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
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
                          <div className="col-span-4"><input type="number" onFocus={(e) => e.target.select()} value={set.weight || ''} onChange={(e) => updateCustomSet(exIdx, setIdx, 'weight', Number(e.target.value))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-bold text-sm outline-none focus:border-accent-blue" /></div>
                          <div className="col-span-4"><input type="number" onFocus={(e) => e.target.select()} value={set.reps || ''} onChange={(e) => updateCustomSet(exIdx, setIdx, 'reps', Number(e.target.value))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-bold text-sm outline-none focus:border-accent-blue" /></div>
                          <div className="col-span-1 flex justify-center"><button onClick={() => removeCustomSet(exIdx, setIdx)} className="text-white/20 hover:text-red-500"><X size={14} /></button></div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addCustomSet(exIdx)} className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-text-dim uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={14} /> Lägg till Set</button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowExerciseLibraryForCustom(true)} className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-2 text-text-dim hover:text-white hover:border-white/30 transition-all"><Plus size={20} /> <span className="font-bold uppercase tracking-widest text-xs">Lägg till övning</span></button>
          </div>

          <div className="p-4 bg-[#1a1721] border-t border-white/10 sticky bottom-0">
            <button onClick={handleSaveCustomPlan} className="w-full py-4 bg-accent-pink text-white rounded-2xl font-black italic uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
              <Save size={20} /> {editingPlanId ? 'Uppdatera Pass' : 'Spara Pass'}
            </button>
          </div>
        </div>
      )}

      {showExerciseLibraryForCustom && (
        <div className="fixed inset-0 z-[120] bg-[#0f0d15]">
          <ExerciseLibrary
            allExercises={allExercises}
            history={history}
            onSelect={(ex) => { handleAddExerciseToCustom(ex); setShowExerciseLibraryForCustom(false); }}
            onClose={() => setShowExerciseLibraryForCustom(false)}
            onUpdate={onUpdate}
          />
        </div>
      )}

      {confirmDelete && (<ConfirmModal title="Radera?" message={confirmDelete.isHistory ? "Är du säker på att du vill radera detta utförda pass? Detta påverkar din statistik." : confirmDelete.isTemplate ? "Detta raderar den återkommande mallen och alla framtida planerade pass för denna rutin." : "Är du säker på att du vill radera detta planerade pass?"} confirmLabel="Radera" isDestructive={true} onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)} />)}

      {/* Color Picker Modal for Planned Activity */}
      {showColorPickerForPlan && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1721] rounded-[40px] border border-white/10 p-8 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic uppercase text-white">Välj Färg</h3>
              <button onClick={() => setShowColorPickerForPlan(null)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <ColorPicker
              selectedColor={optimisticPlannedActivities.find(p => p.id === showColorPickerForPlan)?.color || '#1a1721'}
              onSelectColor={(newColor) => {
                const plan = optimisticPlannedActivities.find(p => p.id === showColorPickerForPlan);
                if (plan) {
                  const isTemplate = 'isTemplate' in plan;
                  handleUpdatePlanColor(showColorPickerForPlan, newColor, isTemplate);
                }
              }}
            />
          </div>
        </div>
      )}

      {selectedItem && (isHistoryItem(selectedItem) ? (
        <HistoryItemModal session={selectedItem} allExercises={allExercises} history={history} onClose={() => setSelectedItem(null)} />
      ) : (
        <WorkoutDetailsModal activity={selectedItem as ScheduledActivity} allExercises={allExercises} onClose={() => setSelectedItem(null)} onStart={onStartActivity} onUpdate={onUpdate} />
      ))}
    </div>
  );
};
