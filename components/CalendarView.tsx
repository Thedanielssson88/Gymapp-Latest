import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkoutSession, PlannedActivityForLogDisplay, ScheduledActivity, RecurringPlanForDisplay } from '../types';

interface CalendarViewProps {
  history: WorkoutSession[];
  plannedActivities: PlannedActivityForLogDisplay[];
  onDayClick: (item: WorkoutSession | PlannedActivityForLogDisplay) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ history, plannedActivities, onDayClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDayClick = (day: Date) => {
    const historyItem = history.find(h => isSameDay(new Date(h.date), day));
    
    const plannedItem = plannedActivities.find(p => {
        if ('isTemplate' in p) {
            const rp = p as RecurringPlanForDisplay;
            if (!rp.daysOfWeek.includes(day.getDay())) return false;
            
            const start = new Date(rp.startDate); start.setHours(0,0,0,0);
            if (day < start) return false;
            
            if (rp.endDate) {
                const end = new Date(rp.endDate); end.setHours(23,59,59,999);
                if (day > end) return false;
            }
            
            const hasConcrete = plannedActivities.some(other => 
                !('isTemplate' in other) && 
                (other as ScheduledActivity).recurrenceId === rp.id && 
                isSameDay(new Date(other.date), day)
            );
            return !hasConcrete;
        }
        return !p.isCompleted && isSameDay(new Date(p.date), day);
    });
    
    if (historyItem) {
      onDayClick(historyItem);
    } else if (plannedItem) {
      onDayClick(plannedItem);
    }
  };

  return (
    <div className="bg-[#1a1721] rounded-[32px] border border-white/5 p-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black italic uppercase text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: sv })}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 bg-white/5 rounded-xl text-text-dim hover:text-white"><ChevronLeft size={20}/></button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 bg-white/5 rounded-xl text-text-dim hover:text-white"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2 text-center">
        {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => (
          <span key={d} className="text-[10px] font-black text-text-dim uppercase">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dayHistory = history.filter(h => isSameDay(new Date(h.date), day));
          
          const dayPlanned = plannedActivities.filter(p => {
             if ('isTemplate' in p) {
                const rp = p as RecurringPlanForDisplay;
                if (!rp.daysOfWeek.includes(day.getDay())) return false;
                
                const start = new Date(rp.startDate); start.setHours(0,0,0,0);
                if (day < start) return false;
                
                if (rp.endDate) {
                    const end = new Date(rp.endDate); end.setHours(23,59,59,999);
                    if (day > end) return false;
                }
                
                const hasConcrete = plannedActivities.some(other => 
                    !('isTemplate' in other) && 
                    (other as ScheduledActivity).recurrenceId === rp.id && 
                    isSameDay(new Date(other.date), day)
                );
                return !hasConcrete;
             }
             return !p.isCompleted && isSameDay(new Date(p.date), day);
          });

          const hasActivity = dayHistory.length > 0 || dayPlanned.length > 0;
          
          const isCurrentMonthDay = isSameMonth(day, monthStart);
          const isTodayMarker = isToday(day);

          let bgClass = 'bg-transparent';
          let borderClass = 'border-transparent';
          if (dayHistory.length > 0) {
            bgClass = 'bg-green-500/10';
            borderClass = 'border-green-500/20';
          } else if (dayPlanned.length > 0) {
            bgClass = 'bg-white/5';
            borderClass = 'border-white/10';
          }
          
          return (
            <button 
              key={i} 
              onClick={() => handleDayClick(day)}
              disabled={!hasActivity}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative border transition-all ${
                isCurrentMonthDay ? '' : 'opacity-20'
              } ${hasActivity ? `${bgClass} ${borderClass} hover:border-accent-pink/50` : ''}`}
            >
              <span className={`text-xs font-bold ${isTodayMarker ? 'text-accent-pink' : 'text-white/80'}`}>
                {format(day, 'd')}
              </span>
              
              <div className="flex gap-0.5 mt-1.5">
                {dayHistory.map((_, idx) => <div key={`h-${idx}`} className="w-1.5 h-1.5 rounded-full bg-green-500" title={`${dayHistory.length} pass loggat`}/>)}
                {dayPlanned.map((_, idx) => <div key={`p-${idx}`} className="w-1.5 h-1.5 rounded-full bg-white/30" title={`${dayPlanned.length} pass planerat`}/>)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};