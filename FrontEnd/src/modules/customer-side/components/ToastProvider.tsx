// src/modules/customer-side/components/ToastProvider.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideToast: (id: string) => void;
  confirmDialog: (options: ConfirmDialogOptions) => Promise<boolean>;
  dismissDialog: () => void;
  promptDialog: (options: PromptDialogOptions) => Promise<string | null>;
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptDialogOptions {
  title: string;
  message: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: 'text' | 'password';
  minLength?: number;
}

type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmDialogOptions }
  | { kind: 'prompt'; options: PromptDialogOptions };

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
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const resolveDialogRef = useRef<((value: boolean | string | null) => void) | null>(null);

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

  const confirmDialog = useCallback((options: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    resolveDialogRef.current = (value) => resolve(value === true);
    setDialog({ kind: 'confirm', options });
  }), []);

  const promptDialog = useCallback((options: PromptDialogOptions) => new Promise<string | null>((resolve) => {
    resolveDialogRef.current = (value) => resolve(typeof value === 'string' ? value : null);
    setPromptValue(options.defaultValue || '');
    setDialog({ kind: 'prompt', options });
  }), []);

  const finishDialog = useCallback((value: boolean | string | null) => {
    resolveDialogRef.current?.(value);
    resolveDialogRef.current = null;
    setDialog(null);
  }, []);
  const dismissDialog = useCallback(() => finishDialog(null), [finishDialog]);

  useEffect(() => {
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTarget = dialog.kind === 'prompt' ? promptRef.current : dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
    focusTarget?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishDialog(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [dialog, finishDialog]);

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
    <ToastContext.Provider value={{ showToast, hideToast, confirmDialog, dismissDialog, promptDialog }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] mx-auto w-full max-w-sm space-y-3 px-4 sm:left-auto sm:right-6 sm:top-6 sm:mx-0 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto rounded-xl px-5 py-4 shadow-2xl transition-all duration-300 ${getToastStyles(toast.type)}`}
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
                type="button"
                onClick={() => hideToast(toast.id)}
                aria-label="Dismiss notification"
                className="text-white/60 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      {dialog && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finishDialog(null);
          }}
        >
          <div
            ref={dialogRef}
            role={dialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-message"
            tabIndex={-1}
            className="w-full max-w-md rounded-t-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 rounded-xl p-2 ${dialog.kind === 'confirm' && dialog.options.danger ? 'bg-red-50 text-red-600' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]'}`}>
                {dialog.kind === 'confirm' && dialog.options.danger ? <AlertTriangle size={19} aria-hidden="true" /> : <span aria-hidden="true">ⓘ</span>}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="app-dialog-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">{dialog.options.title}</h2>
                <p id="app-dialog-message" className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{dialog.options.message}</p>
              </div>
              <button type="button" onClick={() => finishDialog(null)} aria-label="Close dialog" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            {dialog.kind === 'prompt' && (
              <label className="mt-4 block text-sm font-medium text-[var(--oppa-text)]">
                {dialog.options.label}
                <input
                  ref={promptRef}
                  type={dialog.options.type || 'text'}
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  data-min-length={dialog.options.minLength}
                  placeholder={dialog.options.placeholder}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--oppa-border)] px-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (!dialog.options.minLength || promptValue.length >= dialog.options.minLength)) {
                      event.preventDefault();
                      finishDialog(promptValue);
                    }
                  }}
                />
              </label>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => finishDialog(null)} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-gray-50">
                {dialog.kind === 'confirm' ? dialog.options.cancelLabel || 'Cancel' : 'Cancel'}
              </button>
              {dialog.kind === 'confirm' ? (
                <button type="button" onClick={() => finishDialog(true)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white ${dialog.options.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--oppa-green)] hover:opacity-90'}`}>
                  {dialog.options.confirmLabel || 'Confirm'}
                </button>
              ) : (
                <button type="button" disabled={Boolean(dialog.options.minLength && promptValue.length < dialog.options.minLength)} onClick={() => finishDialog(promptValue)} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
export type { ToastContextType };