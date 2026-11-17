import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { LimitedInput } from '../../../components/ui/LimitedInput';
import { INPUT_LIMITS } from '../../../constants/inputLimits';
import { formatCurrency } from '../../../utils/formatters';
import { AdminDate, Avatar } from './AdminUI';

export interface ModalAccount {
  id: string;
  fullName?: string;
  full_name?: string;
  email: string;
  role?: string;
  position?: string;
  location?: string;
  status?: string;
  order_count?: number;
  total_spent?: number;
  date_registered?: string;
  contactNumber?: string;
  phone?: string;
  address?: string;
  created_at?: string;
}

interface AccountModalProps {
  account: ModalAccount;
  onClose: () => void;
  onResetPassword: (id: string, newPassword: string) => void | Promise<void>;
  isReadOnly?: boolean;
}

const formatLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const AccountModal: React.FC<AccountModalProps> = ({ account, onClose, onResetPassword, isReadOnly = false }) => {
  const [newPassword, setNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const displayName = account.fullName || account.full_name || '';
  const isCustomer = account.role?.toLowerCase() === 'customer';
  const roleLabel = account.position ? formatLabel(account.position) : account.role ? formatLabel(account.role) : '';
  const registeredAt = account.date_registered || account.created_at;
  const detailRows: Array<{ label: string; value: React.ReactNode; present: boolean }> = isCustomer
    ? [
      { label: 'Orders', value: account.order_count, present: account.order_count !== undefined && account.order_count !== null },
      { label: 'Total spent', value: account.total_spent !== undefined ? formatCurrency(account.total_spent) : null, present: account.total_spent !== undefined && account.total_spent !== null },
      { label: 'Registered', value: registeredAt ? <AdminDate value={registeredAt} /> : null, present: Boolean(registeredAt) },
    ]
    : [
      { label: 'Position', value: roleLabel, present: Boolean(roleLabel) },
      { label: 'Location', value: account.location, present: Boolean(account.location) },
      { label: 'Status', value: account.status, present: Boolean(account.status) },
      { label: 'Joined', value: account.created_at ? <AdminDate value={account.created_at} /> : null, present: Boolean(account.created_at) },
    ];

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < INPUT_LIMITS.password.min || newPassword.length > INPUT_LIMITS.password.max) {
      setMessage({ type: 'error', text: `Password must be ${INPUT_LIMITS.password.min}-${INPUT_LIMITS.password.max} characters.` });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      await onResetPassword(account.id, newPassword);
      setMessage({ type: 'success', text: 'Password updated' });
      setNewPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to reset password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-details-title"
        className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl sm:max-h-[min(90vh,760px)] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--oppa-border)] px-5 py-4 sm:px-6">
          <Avatar name={displayName} className="size-12 text-sm" />
          <div className="min-w-0 flex-1">
            <h2 id="account-details-title" className="truncate font-serif text-lg font-bold text-[var(--oppa-text)]">{displayName}</h2>
            <p className="truncate text-sm text-[var(--oppa-text-muted)]">{account.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roleLabel && <span className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--oppa-green-dark)]">{roleLabel}</span>}
              {account.status && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.status.toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{account.status}</span>}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close account details"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-[var(--oppa-cream)] p-4">
            {detailRows.filter((row) => row.present).map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs font-medium text-[var(--oppa-text-muted)]">{row.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[var(--oppa-text)]">{row.value}</dd>
              </div>
            ))}
          </dl>

          {!isReadOnly && (
            <section className="border-t border-[var(--oppa-border)] pt-4" aria-labelledby="reset-password-title">
              <h3 id="reset-password-title" className="text-sm font-semibold text-[var(--oppa-text)]">Reset password</h3>
              <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Enter a new password for this account.</p>
              <form onSubmit={(event) => void handleReset(event)} className="mt-3 space-y-3">
                <div>
                  <label htmlFor="account-new-password" className="mb-1.5 block text-xs font-medium text-[var(--oppa-text-muted)]">New password</label>
                  <div className="relative">
                    <LimitedInput
                      id="account-new-password"
                      type={passwordVisible ? 'text' : 'password'}
                      data-min-length={INPUT_LIMITS.password.min}
                      maxLength={INPUT_LIMITS.password.max}
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setMessage(null);
                      }}
                      placeholder="New password"
                      className="h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 pr-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/40"
                    />
                    <button
                      type="button"
                      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                      aria-pressed={passwordVisible}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                    >
                      {passwordVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newPassword || isSubmitting}
                  className="bg-oppa-gradient min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating…' : 'Reset password'}
                </button>
              </form>
              {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{message.text}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
