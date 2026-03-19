import React, { useState } from 'react';
import { Activity, Heart, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { RecoveryIndex } from '../utils/recoveryIndex';

interface RecoveryIndexHeroProps {
  recoveryIndex: RecoveryIndex;
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number;
}

interface CircleProps {
  score: number;
  label: string;
  color: string;
  size?: number;
}

const MiniCircle: React.FC<CircleProps> = ({ score, label, color, size = 60 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-slate-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-slate-300 text-center font-medium">{label}</span>
    </div>
  );
};

export default function RecoveryIndexHero({
  recoveryIndex,
  acuteLoad,
  chronicLoad,
  acuteChronicRatio
}: RecoveryIndexHeroProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { score, muscleScore, loadScore, timeScore, recommendation, color, status } = recoveryIndex;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden">
      {/* Compact View - Always Visible */}
      <div
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Återhämtning</h2>
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: color + '20', color: color }}
            >
              {status === 'excellent' && '🔥 Utmärkt'}
              {status === 'good' && '✓ Bra'}
              {status === 'fair' && '⚠ Okej'}
              {status === 'poor' && '⛔ Dålig'}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* 4 Circles in a Row */}
        <div className="grid grid-cols-4 gap-4">
          <MiniCircle score={score} label="Totalt" color={color} />
          <MiniCircle score={muscleScore} label="Muskler" color="#ef4444" />
          <MiniCircle score={loadScore} label="Belastning" color="#3b82f6" />
          <MiniCircle score={timeScore} label="Vilotid" color="#10b981" />
        </div>
      </div>

      {/* Expanded View - Detailed Information */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Recommendation */}
          <div className="text-center py-2">
            <p className="text-base font-semibold text-white">{recommendation}</p>
          </div>

          {/* Detailed Breakdown Cards */}
          <div className="space-y-3">
            {/* Muskelåterhämtning */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-medium text-slate-300">Muskelåterhämtning</span>
                </div>
                <span className="text-lg font-bold text-white">{muscleScore}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-red-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${muscleScore}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Vikt: 50%</p>
            </div>

            {/* Training Load */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-slate-300">Träningsbelastning</span>
                </div>
                <span className="text-lg font-bold text-white">{loadScore}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${loadScore}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-slate-400">Vikt: 30%</p>
                <p className="text-xs text-slate-400">
                  A:C {acuteChronicRatio.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Vilotid */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-slate-300">Vilotid</span>
                </div>
                <span className="text-lg font-bold text-white">{timeScore}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${timeScore}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Vikt: 20%</p>
            </div>
          </div>

          {/* Training Load Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Akut (7d)</span>
              </div>
              <p className="text-2xl font-bold text-white">{acuteLoad.toFixed(1)}</p>
              <p className="text-xs text-slate-400 mt-1">Dagligt snitt</p>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Kronisk (28d)</span>
              </div>
              <p className="text-2xl font-bold text-white">{chronicLoad.toFixed(1)}</p>
              <p className="text-xs text-slate-400 mt-1">Dagligt snitt</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-300">Återhämtningsindex</strong> kombinerar muskelåterhämtning (50%),
              träningsbelastning (30%) och vilotid (20%) för att ge en helhetsbild av din återhämtning.
              Ett högt värde innebär att du är redo för tung träning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
