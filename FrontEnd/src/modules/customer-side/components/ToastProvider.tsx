// src/modules/customer-side/components/ToastProvider.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3500);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const getToastStyles = (type: string): string => {
    switch(type) {
      case 'success':
        return 'bg-[#2d6a4f] text-white';
      case 'error':
        return 'bg-[#e76f51] text-white';
      case 'warning':
        return 'bg-[#f5a623] text-white';
      default:
        return 'bg-[#2c3e50] text-white';
    }
  };

  const getIcon = (type: string): string => {
    switch(type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] space-y-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-5 py-4 rounded-xl shadow-2xl transition-all duration-300 ${getToastStyles(toast.type)}`}
            style={{
              animation: 'slideIn 0.3s ease-out forwards'
            }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold bg-white/20`}>
                {getIcon(toast.type)}
              </div>
              <span className="flex-1 text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => hideToast(toast.id)}
                className="text-white/60 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
export type { ToastContextType };