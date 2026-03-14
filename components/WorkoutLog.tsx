
import React, { useState, useMemo, useEffect } from 'react';
import { 
  WorkoutSession, ScheduledActivity, ActivityType, 
  WorkoutRoutine, Exercise, TrackingType, RecurringPlanForDisplay, PlannedActivityForLogDisplay, WorkoutSet 
} from '../types';
import { 
  Calendar as CalIcon, ChevronLeft, ChevronRight, CheckCircle2, 
  Circle, Plus, Dumbbell, History, Repeat, Trash2, X, 
  Clock, ChevronDown, ChevronUp, MapPin, TrendingUp, Timer,
  MessageSquare, Activity, Zap, Trophy, CalendarClock, Play, CalendarPlus, List, Calendar as CalendarIcon, ArrowRight
} from 'lucide-react';
import { calculate1RM } from '../utils/fitness';
import { ConfirmModal } from './ConfirmModal';
import { CalendarView } from './CalendarView';
import { HistoryItemModal } from './HistoryItemModal';
import { WorkoutDetailsModal } from './WorkoutDetailsModal';
import { registerBackHandler } from '../utils/backHandler';

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
  onStartActivity: (activity: ScheduledActivity) => void;
  onStartManualWorkout: (date: string) => void;
  onStartLiveWorkout: () => void;
  onUpdate: () => void;
}

export const WorkoutLog: React.FC<WorkoutLogProps> = ({ 
  history, plannedActivities, routines, allExercises,
  onAddPlan, onDeletePlan, onDeleteHistory, onMovePlan, onStartActivity, onStartManualWorkout, onStartLiveWorkout, onUpdate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [confirmDelete, setConfirmDelete] = useState<{id: string, isHistory: boolean, isTemplate: boolean} | null>(null);
  
  // State för att flytta pass
  const [moveModalData, setMoveModalData] = useState<{id: string, title: string, currentDate: string} | null>(null);
  const [customMoveDate, setCustomMoveDate] = useState('');

  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

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

  const handleSavePlan = () => {
    const routine = routines.find(r => r.id === selectedRoutineId);
    const finalTitle = planTitle || routine?.name || 'Nytt Pass';
    const activity: ScheduledActivity = { id: `plan-${Date.now()}`, date: planDate, type: 'gym', title: finalTitle, isCompleted: false, exercises: routine?.exercises || [] };
    onAddPlan(activity, isRecurring, selectedDays);
    setShowPlanModal(false);
    setPlanTitle(''); setSelectedRoutineId(''); setIsRecurring(false); setSelectedDays([]);
  };

  const handleExecuteMove = (targetDate: string) => {
    if (moveModalData) {
        onMovePlan(moveModalData.id, targetDate);
        setMoveModalData(null);
    }
  };

  const handleConfirmDelete = () => { if (confirmDelete) { if (confirmDelete.isHistory) { onDeleteHistory(confirmDelete.id); } else { onDeletePlan(confirmDelete.id, confirmDelete.isTemplate); } setConfirmDelete(null); } };
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
                
                const dayPlans = plannedActivities.filter(p => {
                    if ('isTemplate' in p) {
                        const isScheduledForDay = p.daysOfWeek?.includes(dayOfWeekNum);
                        if (!isScheduledForDay) return false;
                        
                        const hasConcreteInstance = plannedActivities.some((otherP) => 
                            !('isTemplate' in otherP) && 
                            (otherP as ScheduledActivity).recurrenceId === p.id && 
                            otherP.date === dKey
                        );
                        return isScheduledForDay && !hasConcreteInstance;
                    } else {
                        return p.date === dKey && !p.isCompleted;
                    }
                });

                return (<div key={dKey} className="space-y-3"><div className="flex items-center gap-3 px-2"><div className={`h-[1px] flex-1 ${isToday ? 'bg-accent-pink/30' : 'bg-white/5'}`} /><h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-accent-pink' : 'text-text-dim'}`}>{day.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</h4><div className={`h-[1px] flex-1 ${isToday ? 'bg-accent-pink/30' : 'bg-white/5'}`} /></div>
                {dayPlans.map(p => (<div key={p.id} className="bg-accent-blue/5 border border-accent-blue/20 rounded-[28px] p-4 flex justify-between items-center group animate-in zoom-in-95"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue">{'isTemplate' in p ? <Repeat size={18} /> : <CalIcon size={18} />}</div><div><p className="text-xs font-black text-white uppercase italic leading-none mb-1">{p.title}</p><p className="text-[9px] font-bold text-accent-blue/60 uppercase tracking-widest">{'isTemplate' in p ? 'Återkommande' : 'Planerat'} • {p.exercises?.length || 0} övningar</p></div></div><div className="flex items-center gap-1.5">{!('isTemplate' in p) && (<button onClick={() => onStartActivity(p as ScheduledActivity)} className="w-10 h-10 bg-accent-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent-blue/20 active:scale-90 transition-transform"><Play size={18} fill="currentColor" /></button>)}{!('isTemplate' in p) && (<button onClick={() => { setCustomMoveDate(p.date); setMoveModalData({ id: p.id, title: p.title, currentDate: p.date }); }} className="p-2.5 text-text-dim hover:text-white transition-colors"><CalendarClock size={18} /></button>)}<button onClick={() => setConfirmDelete({ id: p.id, isHistory: false, isTemplate: 'isTemplate' in p })} className="p-2.5 text-text-dim hover:text-red-500 transition-colors"><Trash2 size={18} /></button></div></div>))}
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
            plannedActivities={plannedActivities} 
            onDayClick={setSelectedItem} 
          />
        </div>
      )}

      {showDatePicker && (<div className="fixed inset-0 bg-[#0f0d15]/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300"><div className="bg-[#1a1721] border border-white/10 rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95"><button onClick={() => setShowDatePicker(false)} className="absolute top-6 right-6 p-2 text-white/30 hover:text-white"><X size={20}/></button><div className="flex flex-col items-center text-center mb-8"><div className="w-16 h-16 bg-accent-blue/10 rounded-2xl flex items-center justify-center text-accent-blue mb-4"><CalendarPlus size={32} /></div><h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Välj Datum</h3><p className="text-xs text-text-dim mt-1">När utfördes träningen?</p></div><input type="date" value={manualDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setManualDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-center outline-none mb-8 focus:border-accent-blue" /><button onClick={handleStartManual} className="w-full py-5 bg-accent-blue text-white rounded-[24px] font-black italic text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all">Logga detta datum</button></div></div>)}
      {showPlanModal && (<div className="fixed inset-0 z-[105] bg-[#0f0d15]/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"><div className="absolute inset-0 bg-[#0f0d15]/90 backdrop-blur-sm" onClick={() => setShowPlanModal(false)} /><div className="relative bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Planera</h3><button onClick={() => setShowPlanModal(false)} className="p-2 bg-white/5 rounded-full text-text-dim hover:text-white transition-colors"><X size={20} /></button></div><div className="space-y-5"><div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Välj Rutin</label><select value={selectedRoutineId} onChange={e => setSelectedRoutineId(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue/50"><option value="">-- Eget pass --</option>{routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>{!selectedRoutineId && (<div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Namn på passet</label><input placeholder="t.ex. Morgonlöpning..." value={planTitle} onChange={e => setPlanTitle(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-accent-blue/50" /></div>)}<div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5"><div className="flex items-center gap-3"><Repeat size={18} className={isRecurring ? "text-accent-blue" : "text-text-dim"} /><span className="text-xs font-black uppercase text-white tracking-widest">Återkommande</span></div><button onClick={() => setIsRecurring(!isRecurring)} className={`w-12 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-accent-blue' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isRecurring ? 'right-1' : 'left-1'}`} /></button></div>{isRecurring ? (<div className="flex justify-between gap-1">{weekdays.map(day => (<button key={day.id} onClick={() => toggleDay(day.id)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedDays.includes(day.id) ? 'bg-accent-blue border-accent-blue text-white' : 'bg-black/40 border-white/5 text-text-dim'}`}>{day.label}</button>))}</div>) : (<div className="space-y-2"><label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Datum</label><input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" /></div>)}<button onClick={handleSavePlan} className="w-full py-5 bg-white text-black rounded-3xl font-black italic uppercase tracking-widest shadow-xl active:scale-95 transition-transform mt-2">Spara Plan</button></div></div></div>)}

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

      {confirmDelete && (<ConfirmModal title="Radera?" message={confirmDelete.isHistory ? "Är du säker på att du vill radera detta utförda pass? Detta påverkar din statistik." : confirmDelete.isTemplate ? "Detta raderar den återkommande mallen och alla framtida planerade pass för denna rutin." : "Är du säker på att du vill radera detta planerade pass?"} confirmLabel="Radera" isDestructive={true} onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(null)} />)}
      
      {selectedItem && (isHistoryItem(selectedItem) ? (
        <HistoryItemModal session={selectedItem} allExercises={allExercises} history={history} onClose={() => setSelectedItem(null)} />
      ) : (
        <WorkoutDetailsModal activity={selectedItem as ScheduledActivity} allExercises={allExercises} onClose={() => setSelectedItem(null)} onStart={onStartActivity} onUpdate={onUpdate} />
      ))}
    </div>
  );
};
