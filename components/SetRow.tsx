import React, { useState, useMemo } from 'react';
import { WorkoutSet, SetType, TrackingType, Exercise, UserProfile, Equipment } from '../types';
import { Check, Thermometer, Zap, AlertCircle, Timer as TimerIcon, RefreshCw, Ruler, Weight } from 'lucide-react';
import { TimePickerModal } from './TimePickerModal';
import { NumberPickerModal } from './NumberPickerModal';
import { ActiveTimerModal } from './ActiveTimerModal';

interface SetRowProps {
  setIdx: number;
  set: WorkoutSet;
  isCompleted: boolean;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  trackingType?: TrackingType;
  exData: Exercise;
  userProfile: UserProfile;
  availablePlates?: number[];
}

export const SetRow: React.FC<SetRowProps> = ({
  setIdx,
  set,
  isCompleted,
  onUpdate,
  trackingType = 'reps_weight',
  exData,
  userProfile,
  availablePlates
}) => {
  const [activeModal, setActiveModal] = useState<'reps' | 'weight' | 'dist' | 'time' | null>(null);
  const [showActiveTimer, setShowActiveTimer] = useState(false);

  const isBarbellExercise = useMemo(() => 
    exData.equipment.includes(Equipment.BARBELL) || 
    exData.equipment.includes(Equipment.EZ_BAR) ||
    exData.equipment.includes(Equipment.TRAP_BAR), 
  [exData.equipment]);

  const isDumbbellExercise = useMemo(() =>
    exData.equipment.includes(Equipment.DUMBBELL),
  [exData.equipment]);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === null) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const toggleSetType = () => {
    const types: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
    const currentType = set.type || 'normal';
    const nextIndex = (types.indexOf(currentType) + 1) % types.length;
    onUpdate({ type: types[nextIndex] });
  };

  const getStyle = () => {
    switch (set.type) {
      case 'warmup': return { container: 'bg-yellow-500/5 border-yellow-500/30', text: 'text-yellow-500', subText: 'text-yellow-500/60', label: 'VÄRM', icon: <Thermometer size={12} className="text-yellow-500" /> };
      case 'drop': return { container: 'bg-purple-500/5 border-purple-500/30', text: 'text-purple-500', subText: 'text-purple-500/60', label: 'DROP', icon: <Zap size={12} className="text-purple-500" /> };
      case 'failure': return { container: 'bg-red-500/5 border-red-500/30', text: 'text-red-500', subText: 'text-red-500/60', label: 'FAIL', icon: <AlertCircle size={12} className="text-red-500" /> };
      default: return { container: 'bg-[#13111a] border-white/5', text: 'text-white', subText: 'text-text-dim', label: 'SET', icon: null };
    }
  };
  const style = getStyle();

  const renderValueButtons = () => {
    const commonButtonClass = `flex-1 bg-black/30 p-3 rounded-xl border border-white/5 text-center active:scale-95 transition-transform ${isCompleted ? 'opacity-50' : ''}`;
    const commonLabelClass = `text-[8px] block uppercase font-black tracking-widest ${style.subText}`;
    const commonValueClass = `text-lg font-black italic ${style.text}`;

    switch (trackingType) {
      case 'distance_weight':
        return <>
          <button onClick={() => !isCompleted && setActiveModal('weight')} className={commonButtonClass}>
            <span className={commonLabelClass}>Vikt (kg)</span>
            <span className={commonValueClass}>{set.weight || 0}</span>
          </button>
          <button onClick={() => !isCompleted && setActiveModal('dist')} className={commonButtonClass}>
            <span className={commonLabelClass}>Meter</span>
            <span className={commonValueClass}>{set.distance || 0}</span>
          </button>
        </>;
      case 'time_distance':
        return <>
          <button onClick={() => !isCompleted && setActiveModal('dist')} className={commonButtonClass}>
            <span className={commonLabelClass}>Meter</span>
            <span className={commonValueClass}>{set.distance || 0}</span>
          </button>
          <button onClick={() => !isCompleted && setActiveModal('time')} className={commonButtonClass}>
            <span className={commonLabelClass}>Tid</span>
            <span className={commonValueClass}>{formatTime(set.duration)}</span>
          </button>
        </>;
      case 'time_only':
        return <button onClick={() => !isCompleted && setActiveModal('time')} className={`${commonButtonClass} flex-auto`}>
          <span className={commonLabelClass}>Tid</span>
          <span className={commonValueClass}>{formatTime(set.duration)}</span>
        </button>;
      case 'reps_only':
        return <button onClick={() => !isCompleted && setActiveModal('reps')} className={`${commonButtonClass} flex-auto`}>
          <span className={commonLabelClass}>Reps</span>
          <span className={commonValueClass}>{set.reps || 0}</span>
        </button>;
      case 'reps_time_weight':
        return <>
          <button onClick={() => !isCompleted && setActiveModal('weight')} className={commonButtonClass}>
            <span className={commonLabelClass}>Vikt (kg)</span>
            <span className={commonValueClass}>{set.weight || 0}</span>
          </button>
          <button onClick={() => !isCompleted && setActiveModal('reps')} className={commonButtonClass}>
            <span className={commonLabelClass}>Reps</span>
            <span className={commonValueClass}>{set.reps || 0}</span>
          </button>
          <button onClick={() => !isCompleted && setActiveModal('time')} className={`${commonButtonClass} flex-auto`}>
            <span className={commonLabelClass}>På Tid</span>
            <span className={commonValueClass}>{formatTime(set.duration)}</span>
          </button>
        </>;
      case 'reps_weight':
      default:
        return <>
          <button onClick={() => !isCompleted && setActiveModal('weight')} className={commonButtonClass}>
            <span className={commonLabelClass}>Vikt (kg)</span>
            <span className={commonValueClass}>{set.weight || 0}</span>
          </button>
          <button onClick={() => !isCompleted && setActiveModal('reps')} className={commonButtonClass}>
            <span className={commonLabelClass}>Reps</span>
            <span className={commonValueClass}>{set.reps || 0}</span>
          </button>
        </>;
    }
  };

  const getBaseWeight = () => {
    if (isDumbbellExercise) return userProfile.settings?.dumbbellBaseWeight ?? 2;
    if (isBarbellExercise) return userProfile.settings?.barbellWeight ?? 20;
    return 0;
  };

  const minIncrement = useMemo(() => {
    if (availablePlates && availablePlates.length > 0) {
      return Math.min(...availablePlates);
    }
    return 0.25; // Fallback
  }, [availablePlates]);


  return (
    <>
      <div className={`relative flex items-center gap-3 p-3 mb-2 rounded-2xl transition-all duration-300 border ${
        isCompleted 
          ? 'bg-green-500/5 border-green-500/10 opacity-60 grayscale-[0.3]' 
          : `${style.container} shadow-lg scale-[1.01]`
      }`}>
        
        <button onClick={toggleSetType} className="w-10 flex flex-col items-center justify-center border-r border-white/5 pr-2 active:scale-90 transition-transform cursor-pointer group">
          <div className="flex items-center gap-1 mb-0.5">{style.icon}<span className={`text-[9px] font-black uppercase tracking-wider ${style.subText}`}>{style.label}</span></div>
          <span className={`text-xl font-black italic ${isCompleted ? 'text-green-500' : style.text}`}>{setIdx + 1}</span>
        </button>

        <div className="flex-1 flex gap-2">
          {renderValueButtons()}
        </div>

        <div className="pl-2">
          {(trackingType === 'time_only' || trackingType === 'time_distance' || trackingType === 'reps_time_weight') && !isCompleted ? (
            <button 
              onClick={() => setShowActiveTimer(true)} 
              className="w-12 h-12 bg-accent-blue/10 border border-accent-blue/20 rounded-xl flex items-center justify-center text-accent-blue transition-all active:scale-90"
            >
              <TimerIcon size={22} />
            </button>
          ) : (
            <button 
              onClick={() => onUpdate({ completed: !isCompleted })} 
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90 shadow-lg ${ isCompleted ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-[#25222e] text-white/20 border border-white/5 hover:border-accent-pink/50 hover:text-accent-pink' }`}
            >
              <Check size={24} strokeWidth={4} />
            </button>
          )}
        </div>
      </div>
      
      {/* MODALS */}
      {showActiveTimer && (
        <ActiveTimerModal
          initialSeconds={set.duration || 60}
          onClose={() => setShowActiveTimer(false)}
          exerciseName={exData.name}
          vibrateEnabled={userProfile.settings?.vibrateTimer ?? true}
          askForReps={trackingType === 'reps_time_weight'}
          targetReps={set.reps || 0}
          onComplete={result => {
            const updates: Partial<WorkoutSet> = {
              duration: result.time,
              completed: true,
            };
            if (result.reps !== undefined) {
              updates.reps = result.reps;
            }
            onUpdate(updates);
            setShowActiveTimer(false);
          }}
        />
      )}

      {activeModal === 'time' && (
        <TimePickerModal 
          title="Ange Tid"
          totalSeconds={set.duration || 0}
          onSelect={(s) => onUpdate({ duration: s })}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'dist' && (
        <NumberPickerModal 
          title="Ange Distans"
          unit="m"
          value={set.distance || 0}
          step={50}
          precision={0}
          min={0}
          max={99999}
          userProfile={userProfile}
          onSave={(v) => { onUpdate({ distance: v }); setActiveModal(null); }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'reps' && (
        <NumberPickerModal 
          title="Ange Reps"
          unit="reps"
          value={set.reps || 0}
          step={1}
          precision={0}
          min={0}
          max={999}
          userProfile={userProfile}
          onSave={(v) => { onUpdate({ reps: v }); setActiveModal(null); }}
          onClose={() => setActiveModal(null)}
        />
      )}
      
      {activeModal === 'weight' && (
        <NumberPickerModal 
          title="Ange Vikt"
          unit="kg"
          value={set.weight || 0}
          step={minIncrement}
          precision={2}
          min={0}
          max={999}
          userProfile={userProfile}
          barWeight={getBaseWeight()}
          availablePlates={availablePlates}
          onSave={(v) => { onUpdate({ weight: v }); setActiveModal(null); }}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
};
