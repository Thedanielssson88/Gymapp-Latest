
import React, { useMemo, useState, useEffect } from 'react';
import { UserMission, WorkoutSession, BiometricLog } from '../types';
import { calculateSmartProgression, getHistoryForGoal } from '../utils/progression';
import { storage } from '../services/storage';
import { X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { registerBackHandler } from '../utils/backHandler';

interface Props {
  mission: UserMission;
  onClose: () => void;
}

export const MissionStatusModal: React.FC<Props> = ({ mission, onClose }) => {
  const [historyPoints, setHistoryPoints] = useState<any[]>([]);
  const [currentVal, setCurrentVal] = useState(0);

  useEffect(() => {
    return registerBackHandler(onClose);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
        document.body.style.overflow = 'auto';
    };
  }, []);
  
  useEffect(() => {
    const loadData = async () => {
      if (!mission.smartConfig) return;
      
      let points = [];
      if (mission.smartConfig.targetType === 'exercise') {
        const hLogs = await storage.getHistory();
        points = getHistoryForGoal(mission.smartConfig, hLogs, []);
      } else {
        const bLogs = await storage.getBiometricLogs();
        points = getHistoryForGoal(mission.smartConfig, [], bLogs);
      }
      
      setHistoryPoints(points);
      const last = points.length > 0 ? points[points.length - 1].value : mission.smartConfig.startValue;
      setCurrentVal(last);
    };
    loadData();
  }, [mission]);

  const stats = useMemo(() => {
    return calculateSmartProgression(mission, currentVal);
  }, [mission, currentVal]);

  const chartData = useMemo(() => {
    const { smartConfig, createdAt } = mission;
    if (!smartConfig) return [];
    
    const { startValue, targetValue, deadline } = smartConfig;
    const hasDeadline = !!deadline;
    const startDate = new Date(createdAt || new Date()).getTime();
    
    const data: any[] = [];
    
    historyPoints.forEach(pt => {
        data.push({
            timestamp: new Date(pt.date).getTime(),
            date: new Date(pt.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
            actual: pt.value,
            ideal: null,
            estimated: null
        });
    });

    if (hasDeadline) {
        const endDate = new Date(deadline).getTime();
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const time = startDate + (endDate - startDate) * ratio;
            const idealVal = startValue + (targetValue - startValue) * ratio;
            
            data.push({
                timestamp: time,
                date: new Date(time).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
                ideal: parseFloat(idealVal.toFixed(1)),
                actual: null,
                estimated: null
            });
        }
    } else {
        if (historyPoints.length > 1) {
            const lastPt = historyPoints[historyPoints.length - 1];
            const timeDiff = new Date(lastPt.date).getTime() - startDate;
            const valDiff = lastPt.value - startValue;
            
            if (timeDiff > 0) {
                const changePerDay = valDiff / (timeDiff / (1000 * 60 * 60 * 24));
                const daysToProject = 30;
                const futureTime = new Date().getTime() + (daysToProject * 24 * 60 * 60 * 1000);
                const estimatedVal = currentVal + (changePerDay * daysToProject);

                data.push({
                    timestamp: futureTime,
                    date: 'Estimering',
                    estimated: parseFloat(estimatedVal.toFixed(1)),
                    actual: null, 
                    ideal: null
                });
                
                data.push({
                   timestamp: new Date().getTime(),
                   date: 'Idag',
                   estimated: currentVal,
                   actual: null,
                   ideal: null
                });
            }
        }
    }

    return data.sort((a, b) => a.timestamp - b.timestamp);
  }, [mission, historyPoints, currentVal]);

  if (!stats || !mission.smartConfig) return null;

  const isAhead = (mission.smartConfig.targetValue > mission.smartConfig.startValue) 
    ? stats.statusDiff <= 0
    : stats.statusDiff >= 0;

  return (
    <div className="fixed inset-0 z-[60] bg-[#0f0d15] flex flex-col animate-in slide-in-from-bottom duration-300">
       <div className="p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] flex justify-between items-center border-b border-white/5">
         <div>
            <p className="text-[10px] text-text-dim uppercase tracking-widest">Statusrapport</p>
            <h2 className="text-xl font-black italic text-white uppercase">{mission.title}</h2>
         </div>
         <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><X className="text-white" size={20}/></button>
       </div>

       <div className="p-6 space-y-6 overflow-y-auto overscroll-contain">
         {mission.smartConfig.deadline && stats ? (
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1a1721] p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-text-dim uppercase font-bold">Mål för dagen</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white">{stats.expectedValue}</span>
                        <span className="text-sm font-bold text-text-dim">{stats.unit}</span>
                    </div>
                </div>
                <div className={`p-4 rounded-2xl border flex flex-col justify-center ${stats.statusDiff > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <p className={`text-[10px] uppercase font-bold ${stats.statusDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>Status</p>
                    <span className="text-lg font-bold text-white">
                        {Math.abs(stats.statusDiff).toFixed(1)} {stats.unit} {stats.statusDiff > 0 ? 'efter' : 'före'}
                    </span>
                </div>
             </div>
         ) : (
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                 <p className="text-sm text-text-dim italic">Detta mål har ingen deadline. Grafen visar din historik och en estimerad utveckling baserat på din nuvarande takt.</p>
             </div>
         )}

         <div className="h-64 bg-[#1a1721] rounded-3xl p-4 border border-white/5 relative">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px'}}
                    />
                    <ReferenceLine y={mission.smartConfig.targetValue} stroke="#2ed573" strokeDasharray="3 3" label="Mål" />
                    
                    <Line type="monotone" dataKey="ideal" name="Plan" stroke="#666" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="estimated" name="Prognos" stroke="#3b82f6" strokeDasharray="3 3" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" name="Utfall" stroke="#fff" strokeWidth={3} dot={{r: 4, fill:'#fff'}} connectNulls />
                </LineChart>
            </ResponsiveContainer>
         </div>
       </div>
    </div>
  );
};
