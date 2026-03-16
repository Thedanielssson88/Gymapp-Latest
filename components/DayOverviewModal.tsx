import React, { useEffect } from 'react';
import { X, Play, Calendar, Repeat, CheckCircle2, Dumbbell, Clock, MapPin } from 'lucide-react';
import { WorkoutSession, PlannedActivityForLogDisplay, ScheduledActivity, RecurringPlanForDisplay, Exercise } from '../types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { registerBackHandler } from '../utils/backHandler';

interface DayOverviewModalProps {
  date: Date;
  history: WorkoutSession[];
  plannedActivities: PlannedActivityForLogDisplay[];
  allExercises: Exercise[];
  onClose: () => void;
  onStartPlanned: (activity: ScheduledActivity) => void;
  onViewHistory: (session: WorkoutSession) => void;
  onAddPlan: (activity: ScheduledActivity, isRecurring: boolean) => void;
}

export const DayOverviewModal: React.FC<DayOverviewModalProps> = ({
  date,
  history,
  plannedActivities,
  allExercises,
  onClose,
  onStartPlanned,
  onViewHistory,
  onAddPlan,
}) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const unregister = registerBackHandler(onClose);
    return () => {
      document.body.style.overflow = 'auto';
      unregister();
    };
  }, [onClose]);

  const dateKey = date.toISOString().split('T')[0];
  const dayOfWeekNum = date.getDay();

  // Hämta alla pass för denna dag
  const dayHistory = history.filter(h => h.date.startsWith(dateKey));

  console.log('🔍 DayOverviewModal Debug:', {
    dateKey,
    totalHistory: history.length,
    dayHistoryCount: dayHistory.length,
    dayHistoryDates: dayHistory.map(h => h.date),
    allHistoryDates: history.map(h => h.date).slice(0, 10)
  });

  const dayPlanned = plannedActivities.filter(p => {
    if ('isTemplate' in p) {
      const rp = p as RecurringPlanForDisplay;
      if (!rp.daysOfWeek?.includes(dayOfWeekNum)) return false;

      const hasConcrete = plannedActivities.some(
        (otherP) =>
          !('isTemplate' in otherP) &&
          (otherP as ScheduledActivity).recurrenceId === rp.id &&
          otherP.date === dateKey
      );
      return !hasConcrete;
    } else {
      return p.date === dateKey && !p.isCompleted;
    }
  });

  const handleStartPlanned = async (p: PlannedActivityForLogDisplay) => {
    const isTemplate = 'isTemplate' in p;

    if (isTemplate) {
      // För recurring templates: skapa en konkret aktivitet
      const activityId = `recurring-start-${Date.now()}`;
      const concreteActivity: ScheduledActivity = {
        id: activityId,
        date: dateKey,
        type: p.type,
        title: p.title,
        isCompleted: false,
        exercises: p.exercises || [],
        recurrenceId: p.id,
      };
      // Spara aktiviteten först
      await onAddPlan(concreteActivity, false);
      // Starta passet
      onStartPlanned(concreteActivity);
    } else {
      // För konkreta planerade pass: starta direkt
      onStartPlanned(p as ScheduledActivity);
    }
  };

  const hasAnyActivity = dayHistory.length > 0 || dayPlanned.length > 0;

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1721] w-full max-w-md max-h-[85vh] flex flex-col rounded-[40px] border border-white/10 shadow-2xl animate-in zoom-in-95">

        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-start">
          <div>
            <span className="text-[10px] text-text-dim font-black uppercase tracking-widest mb-2 block">
              Dagöversikt
            </span>
            <h3 className="text-2xl font-black italic text-white uppercase leading-tight pr-4">
              {format(date, 'EEEE d MMMM', { locale: sv })}
            </h3>
            <div className="flex items-center gap-3 mt-3 text-[10px] font-bold text-text-dim uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-green-500" />
                {dayHistory.length} genomförda
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={12} className="text-accent-blue" />
                {dayPlanned.length} planerade
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-white shrink-0">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 overflow-y-auto flex-1 space-y-6 scrollbar-hide overscroll-contain">

          {!hasAnyActivity && (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={28} className="text-text-dim" />
              </div>
              <p className="text-sm font-bold text-text-dim uppercase tracking-widest">
                Inga pass denna dag
              </p>
            </div>
          )}

          {/* Planerade Pass */}
          {dayPlanned.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-blue flex items-center gap-2">
                <Calendar size={12} /> Planerade Pass
              </h4>
              {dayPlanned.map((p) => {
                const isTemplate = 'isTemplate' in p;
                return (
                  <div
                    key={p.id}
                    className="bg-accent-blue/5 border border-accent-blue/20 rounded-2xl p-4 space-y-3 animate-in zoom-in-95"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue">
                          {isTemplate ? <Repeat size={18} /> : <Calendar size={18} />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase italic leading-none mb-1">
                            {p.title}
                          </p>
                          <p className="text-[9px] font-bold text-accent-blue/60 uppercase tracking-widest">
                            {isTemplate ? 'Återkommande' : 'Planerat'} • {p.exercises?.length || 0} övningar
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartPlanned(p)}
                      className="w-full bg-green-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                    >
                      <Play size={16} fill="currentColor" /> Starta Pass
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Genomförda Pass */}
          {dayHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 flex items-center gap-2">
                <CheckCircle2 size={12} /> Genomförda Pass
              </h4>
              {dayHistory.map((session) => {
                const endTime = session.duration
                  ? new Date(new Date(session.date).getTime() + session.duration * 1000)
                  : null;
                const endTimeString = endTime
                  ? endTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <button
                    key={session.id}
                    onClick={() => onViewHistory(session)}
                    className="w-full bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-left hover:bg-green-500/10 hover:border-green-500/30 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                        <Dumbbell size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-white uppercase italic leading-none mb-1">
                          {session.name}
                        </p>
                        <div className="flex items-center gap-3 text-[9px] font-bold text-text-dim uppercase tracking-widest">
                          {session.isManual ? (
                            <span className="flex items-center gap-1"><Clock size={10} /> Efterhand</span>
                          ) : endTimeString ? (
                            <span className="flex items-center gap-1"><Clock size={10} /> {endTimeString}</span>
                          ) : null}
                          {session.locationName && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {session.locationName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-text-dim uppercase tracking-widest">
                      <span>{session.exercises.length} övningar</span>
                      <span className="text-green-500">Visa detaljer →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
