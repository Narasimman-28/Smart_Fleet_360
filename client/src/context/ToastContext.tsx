import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showSuccess: (message?: string) => void;
  showError: (message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const showSuccess = useCallback((message = 'Record deleted successfully.') => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message = 'Unable to delete this record. Please try again.') => {
    showToast(message, 'error');
  }, [showToast]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-md w-full pointer-events-none p-2 sm:p-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-slideUp ${
              toast.type === 'success'
                ? 'bg-[#0F2A1A] border-[#22C55E] text-[#F5F5F5] shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                : toast.type === 'error'
                ? 'bg-[#3F1111] border-[#B71C1C] text-[#FF6B6B] shadow-[0_0_15px_rgba(229,57,53,0.3)]'
                : 'bg-[#18181B] border-[#3F3F46] text-[#F5F5F5] shadow-[0_0_15px_rgba(0,0,0,0.5)]'
            }`}
            role="alert"
          >
            <div className="flex items-center space-x-3">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#FF1744] shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#60A5FA] shrink-0" />}
              <span className="text-xs font-semibold leading-relaxed text-[#F5F5F5]">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 p-1 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#27272A] transition cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if not inside provider
    return {
      showToast: (msg: string) => console.log('[Toast]', msg),
      showSuccess: (msg = 'Record deleted successfully.') => console.log('[Toast Success]', msg),
      showError: (msg = 'Unable to delete this record. Please try again.') => console.error('[Toast Error]', msg)
    };
  }
  return context;
};

export default ToastProvider;
