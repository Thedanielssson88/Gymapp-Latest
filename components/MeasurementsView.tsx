
import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, BiometricLog, BodyMeasurements } from '../types';
import { storage } from '../services/storage';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  ChevronLeft, Plus, Calendar, History, 
  TrendingUp, Scale, Ruler, Check, X 
} from 'lucide-react';

interface MeasurementsViewProps {
  profile: UserProfile;
  onUpdate: () => void;
}

// Definition of fields to display
const MEASUREMENT_CONFIG = [
  { key: 'weight', label: 'Vikt', unit: 'kg', icon: '⚖️' },
  { key: 'neck', label: 'Nacke', unit: 'cm', icon: '🧣' },
  { key: 'shoulders', label: 'Axlar', unit: 'cm', icon: '🔱' },
  { key: 'chest', label: 'Bröst', unit: 'cm', icon: '👕' },
  { key: 'waist', label: 'Midja', unit: 'cm', icon: '📏' },
  { key: 'hips', label: 'Höfter', unit: 'cm', icon: '🍑' },
  { key: 'bicepsL', label: 'Vänster Biceps', unit: 'cm', icon: '💪', pair: 'biceps' },
  { key: 'bicepsR', label: 'Höger Biceps', unit: 'cm', icon: '💪', pair: 'biceps' },
  { key: 'thighL', label: 'Vänster Lår', unit: 'cm', icon: '🍗', pair: 'thigh' },
  { key: 'thighR', label: 'Höger Lår', unit: 'cm', icon: '🍗', pair: 'thigh' },
  { key: 'calvesL', label: 'Vänster Vad', unit: 'cm', icon: '🦵', pair: 'calves' },
  { key: 'calvesR', label: 'Höger Vad', unit: 'cm', icon: '🦵', pair: 'calves' },
];

export const MeasurementsView: React.FC<MeasurementsViewProps> = ({ profile, onUpdate }) => {
  const [selectedField, setSelectedField] = useState<typeof MEASUREMENT_CONFIG[0] | null>(null);
  const [history, setHistory] = useState<BiometricLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Load history from storage
  useEffect(() => {
    const loadHistory = async () => {
      const logs = await storage.getBiometricLogs();
      setHistory(logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setLoading(false);
    };
    loadHistory();
  }, []);

  const latestLog = useMemo(() => history[history.length - 1], [history]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER STATS */}
      <div className="px-2">
        <div className="bg-gradient-to-br from-[#1a1721] to-[#110f16] p-6 rounded-[40px] border border-white/5 shadow-2xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-text-dim tracking-[0.2em] mb-1">Status</p>
              <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Kroppsmått</h2>
            </div>
            <div className="bg-accent-pink/10 p-3 rounded-2xl border border-accent-pink/20">
              <Ruler className="text-accent-pink" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* GRID WITH CARDS */}
      <div className="grid grid-cols-2 gap-3 px-2 pb-32">
        {MEASUREMENT_CONFIG.map((field) => {
          const value = field.key === 'weight' 
            ? latestLog?.weight 
            : latestLog?.measurements?.[field.key as keyof BodyMeasurements];

          return (
            <button
              key={field.key}
              onClick={() => setSelectedField(field)}
              className="bg-[#1a1721] p-5 rounded-[32px] border border-white/5 flex flex-col items-start gap-3 active:scale-95 transition-all group hover:border-accent-pink/20 text-left"
            >
              <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-xl group-hover:bg-accent-pink/10 transition-colors">
                {field.icon}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-text-dim tracking-widest mb-1">{field.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black italic text-white">{value || '--'}</span>
                  <span className="text-[10px] font-bold text-text-dim uppercase">{field.unit}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* DETAIL MODAL */}
      {selectedField && (
        <MeasurementDetailModal 
          field={selectedField}
          history={history}
          profile={profile}
          onClose={() => setSelectedField(null)}
          onSave={async (val, date) => {
            const currentMeasurements = { ...(latestLog?.measurements || profile.measurements || {}) };
            
            const newLog: BiometricLog = {
              id: `log-${Date.now()}`,
              date: date.toISOString(),
              weight: selectedField.key === 'weight' ? val : (latestLog?.weight || profile.weight),
              measurements: {
                ...currentMeasurements,
                [selectedField.key]: selectedField.key !== 'weight' ? val : (currentMeasurements[selectedField.key as keyof BodyMeasurements])
              }
            };
            
            await storage.saveBiometricLog(newLog);
            
            const updatedProfile = {
                ...profile,
                weight: newLog.weight,
                measurements: newLog.measurements
            };
            await storage.setUserProfile(updatedProfile);
            
            onUpdate();
            
            const logs = await storage.getBiometricLogs();
            setHistory(logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            
            setSelectedField(null);
          }}
        />
      )}
    </div>
  );
};

interface DetailModalProps {
    field: typeof MEASUREMENT_CONFIG[0];
    history: BiometricLog[];
    profile: UserProfile;
    onClose: () => void;
    onSave: (val: number, date: Date) => Promise<void>;
}

const MeasurementDetailModal: React.FC<DetailModalProps> = ({ field, history, onClose, onSave }) => {
  const [newValue, setNewValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Prevent background scrolling when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Prepare data for graph
  const chartData = useMemo(() => {
    return history
      .map((log: BiometricLog) => ({
        date: new Date(log.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
        value: field.key === 'weight' ? log.weight : log.measurements?.[field.key as keyof BodyMeasurements]
      }))
      .filter((d: any) => d.value !== undefined);
  }, [history, field.key]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#0f0d15] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      {/* MODAL HEADER */}
      <div className="p-6 flex justify-between items-center border-b border-white/5 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-white active:scale-90 transition-transform"><ChevronLeft /></button>
          <div>
            <h3 className="text-xl font-black italic uppercase text-white leading-none">{field.label}</h3>
            <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mt-1">Historik & Registrering</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-text-dim hover:text-white transition-colors">
            <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 overscroll-contain">
        {/* GRAPH SECTION */}
        <div className="bg-[#1a1721] p-4 rounded-[32px] border border-white/5 h-64 shadow-inner">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff2d55" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1721', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="value" stroke="#ff2d55" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-dim opacity-50">
              <TrendingUp size={48} strokeWidth={1} />
              <p className="text-[10px] font-black uppercase mt-4">Behöver minst två mätningar för graf</p>
            </div>
          )}
        </div>

        {/* INPUT SECTION */}
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Registrera Nytt Mått ({field.unit})</label>
            <div className="relative">
              <input 
                autoFocus
                onFocus={(e) => e.target.select()}
                type="number" 
                step="0.1"
                placeholder="0.0"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-[#1a1721] border border-white/10 rounded-3xl p-6 text-4xl font-black italic text-white outline-none focus:border-accent-pink transition-all"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xl font-black italic text-text-dim uppercase pointer-events-none">{field.unit}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-text-dim ml-2 tracking-widest">Datum</label>
            {/* Datumbehållaren är nu strikt relative så att input inte läcker ut */}
            <div className="relative bg-[#1a1721] border border-white/10 rounded-3xl p-5 flex items-center justify-between overflow-hidden cursor-pointer hover:border-white/20 transition-colors">
              <div className="flex items-center gap-3">
                <Calendar className="text-accent-pink" size={20} />
                <span className="text-sm font-bold text-white">{selectedDate.toLocaleDateString('sv-SE')}</span>
              </div>
              
              {/* Den osynliga inputen täcker nu EXAKT denna ruta tack vare parent: relative */}
              <input 
                type="date" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                value={selectedDate.toISOString().split('T')[0]}
              />
              
              <button className="text-[10px] font-black uppercase text-accent-blue pointer-events-none">Ändra</button>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTION */}
      <div className="p-6 bg-[#0f0d15] border-t border-white/5 pb-safe shrink-0">
        <button 
          onClick={() => newValue && onSave(parseFloat(newValue), selectedDate)}
          disabled={!newValue}
          className="w-full py-5 bg-white text-black rounded-3xl font-black italic uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-20 shadow-xl"
        >
          <Check size={24} strokeWidth={4} /> Spara Mätning
        </button>
      </div>
    </div>
  );
};
