import React, { useState, useEffect } from 'react';
import { X, Check, Trophy } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { registerBackHandler } from '../utils/backHandler';

interface ActiveTimerModalProps {
  initialSeconds: number;
  onClose: () => void;
  onComplete: (result: { time: number; reps?: number }) => void;
  exerciseName: string;
  vibrateEnabled?: boolean;
  askForReps?: boolean;
  targetReps?: number;
}

export const ActiveTimerModal: React.FC<ActiveTimerModalProps> = ({
  initialSeconds,
  onClose,
  onComplete,
  exerciseName,
  vibrateEnabled = true,
  askForReps = false,
  targetReps = 0,
}) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);

  const [showResultInput, setShowResultInput] = useState(false);
  const [actualReps, setActualReps] = useState<string>(targetReps > 0 ? String(targetReps) : '');
  const [timeForReps, setTimeForReps] = useState(0);

  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const progress = isOvertime ? 1 : initialSeconds > 0 ? timeLeft / initialSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;

  useEffect(() => {
    const unregister = registerBackHandler(onClose);
    const timer = setInterval(() => {
      setTotalElapsed(prev => prev + 1);
  
      if (isOvertime) {
        setTimeLeft(prev => prev + 1);
        return;
      }
  
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (vibrateEnabled) {
            haptics.impact();
          }
          if (askForReps) {
            setTimeForReps(initialSeconds);
            setShowResultInput(true);
          } else {
            setIsOvertime(true);
          }
          return 0;
        }
        
        // Haptic countdown logic
        if (vibrateEnabled && prev <= 6 && prev > 1) {
          haptics.selection();
        }
        
        return prev - 1;
      });
    }, 1000);
  
    return () => {
      clearInterval(timer);
      unregister();
    };
  }, [isOvertime, askForReps, initialSeconds, onClose, vibrateEnabled]);

  const handleFinish = (time: number) => {
    if (askForReps) {
      setTimeForReps(time);
      setShowResultInput(true);
    } else {
      onComplete({ time });
    }
  };

  const submitResults = () => {
    const finalReps = actualReps ? parseInt(actualReps) : 0;
    onComplete({
      time: timeForReps,
      reps: finalReps,
    });
  };

  if (showResultInput) {
    const diff = (parseInt(actualReps) || 0) - targetReps;
    const isBetter = diff > 0;
    const isSame = diff === 0;

    return (
      <div className="fixed inset-0 z-[600] bg-[#1a1721] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic uppercase text-white tracking-wider">Tiden är ute!</h2>
            <p className="text-gray-400">Hur många reps klarade du?</p>
          </div>
          <div className="relative">
            <input
              type="number"
              value={actualReps}
              onChange={e => setActualReps(e.target.value)}
              placeholder={targetReps.toString()}
              autoFocus
              className="w-full bg-white/5 border-2 border-accent-blue rounded-3xl py-8 text-center text-6xl font-black text-white outline-none focus:shadow-[0_0_40px_rgba(59,130,246,0.3)] transition-all"
            />
            <div className="absolute top-1/2 -translate-y-1/2 right-6 text-gray-500 font-bold text-xl pointer-events-none">REPS</div>
          </div>
          {actualReps !== '' && (
            <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div
                className={`text-xl font-bold flex items-center justify-center gap-2 ${isBetter ? 'text-green-400' : isSame ? 'text-blue-400' : 'text-gray-400'}`}>
                {isBetter ? <Trophy size={24} /> : isSame ? <Check size={24} /> : null}
                {isBetter ? `+${diff} mot målet!` : isSame ? 'Exakt på målet!' : `${diff} från målet`}
              </div>
              <p className="text-white italic font-medium">
                {isBetter ? 'Fan vad starkt jobbat! 💪' : isSame ? 'Snyggt, stabilt pass! 🔥' : 'Bra kämpat ändå! Nästa gång tar vi det.'}
              </p>
            </div>
          )}
          <button
            onClick={submitResults}
            disabled={!actualReps}
            className="w-full bg-accent-blue text-black py-5 rounded-2xl font-black uppercase text-xl tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100">
            Spara Resultat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-text-dim mb-12">{exerciseName}</h3>
        <div className="relative flex items-center justify-center w-64 h-64 mb-16">
          <svg className="transform -rotate-90 w-full h-full overflow-visible">
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={circumference}
              style={{ strokeDashoffset, transition: isOvertime ? 'none' : 'stroke-dashoffset 1s linear' }}
              className={`${isOvertime ? 'text-green-500' : 'text-accent-blue'}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <div className={`text-6xl font-black italic tracking-tighter ${isOvertime ? 'text-green-500' : 'text-white'}`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
            {isOvertime && <span className="text-[10px] font-black text-green-500 uppercase tracking-widest animate-pulse mt-2">Övertid</span>}
          </div>
        </div>
        <div className="w-full space-y-4 px-6">
          <button onClick={() => handleFinish(totalElapsed)} className="w-full py-5 bg-green-500 text-black rounded-3xl font-black uppercase italic tracking-widest shadow-xl flex items-center justify-center gap-2">
            <Check size={20} strokeWidth={3} /> Klar (Total: {Math.floor(totalElapsed / 60)}:{(totalElapsed % 60).toString().padStart(2, '0')})
          </button>
          <button onClick={() => handleFinish(initialSeconds)} className="w-full py-4 bg-white/5 text-white/40 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            Klar (Enligt pass: {Math.floor(initialSeconds / 60)}:{(initialSeconds % 60).toString().padStart(2, '0')})
          </button>
          <button onClick={onClose} className="w-full text-red-500/50 text-[10px] font-black uppercase tracking-widest mt-4">Avbryt</button>
        </div>
      </div>
    </div>
  );
};