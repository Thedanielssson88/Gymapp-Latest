import React, { useEffect } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, message, confirmLabel = "Ja, fortsätt", cancelLabel = "Avbryt", isDestructive = false, onConfirm, onCancel 
}) => {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div 
        className="bg-[#1a1721] border border-white/10 rounded-[32px] p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-accent-blue/10 text-accent-blue'}`}>
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-black italic uppercase text-white leading-tight tracking-tighter">{title}</h3>
        </div>

        <p className="text-sm text-text-dim mb-8 font-medium leading-relaxed text-center">
          {message}
        </p>

        <div className="flex flex-col gap-2">
          <button 
            onClick={onConfirm}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              isDestructive 
                ? 'bg-red-500 text-white shadow-[0_10px_20px_rgba(239,68,68,0.2)] active:scale-95' 
                : 'bg-white text-black shadow-lg active:scale-95'
            }`}
          >
            {confirmLabel} <Check size={16} strokeWidth={4} />
          </button>
          
          <button 
            onClick={onCancel}
            className="w-full py-4 bg-transparent text-text-dim hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
