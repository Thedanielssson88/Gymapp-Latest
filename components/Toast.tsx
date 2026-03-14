import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
    warning: <AlertTriangle size={20} />
  };

  const styles = {
    success: 'bg-accent-green/20 border-accent-green text-accent-green',
    error: 'bg-red-500/20 border-red-500 text-red-400',
    info: 'bg-accent-blue/20 border-accent-blue text-accent-blue',
    warning: 'bg-amber-500/20 border-amber-500 text-amber-400'
  };

  return (
    <div
      className={`fixed top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 z-[400] max-w-sm w-[calc(100%-2rem)] px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300 ${styles[type]}`}
      onClick={onClose}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          {icons[type]}
        </div>
        <p className="text-sm font-bold flex-1 leading-snug">
          {message}
        </p>
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toast, setToast] = React.useState<{ message: string; type: ToastType } | null>(null);

  const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = React.useCallback(() => {
    setToast(null);
  }, []);

  const ToastComponent = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={hideToast} />
  ) : null;

  return { showToast, ToastComponent };
};
