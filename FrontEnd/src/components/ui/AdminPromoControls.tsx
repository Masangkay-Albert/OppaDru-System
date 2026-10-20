import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { IconType } from 'react-icons';
import {
  LuBanknote,
  LuCircleCheck,
  LuPercent,
  LuTag,
  LuX,
} from 'react-icons/lu';
import { createPortal } from 'react-dom';

interface IconButtonProps {
  icon: IconType;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export function IconButton({ icon: Icon, label, onClick, tone = 'default', disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 place-items-center rounded-lg text-[var(--oppa-text-muted)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger'
          ? 'hover:bg-[var(--promo-danger-bg)] hover:text-[var(--promo-danger-text)]'
          : 'hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-green)]'
      }`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export function StatusBadge({ active, expired = false }: { active: boolean; expired?: boolean }) {
  const label = expired ? 'Expired' : active ? 'Active' : 'Inactive';
  const Icon = expired ? LuTag : LuCircleCheck;
  const tone = expired
    ? 'border-[var(--promo-warning-border)] bg-[var(--promo-warning-bg)] text-[var(--promo-warning-text)]'
    : active
      ? 'border-[var(--promo-success-border)] bg-[var(--promo-success-bg)] text-[var(--promo-success-text)]'
      : 'border-[var(--oppa-border)] bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export function CategoryBadge({ children, neutral = false }: { children: ReactNode; neutral?: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
      neutral
        ? 'border-[var(--oppa-border)] bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]'
        : 'border-[var(--promo-info-border)] bg-[var(--promo-info-bg)] text-[var(--promo-info-text)]'
    }`}>
      {children}
    </span>
  );
}

export function DiscountBadge({ type, value }: { type: 'percent' | 'fixed'; value: number }) {
  const Icon = type === 'percent' ? LuPercent : LuBanknote;
  const text = type === 'percent' ? `${value}% OFF` : `${new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)} OFF`;

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--promo-success-border)] bg-[var(--promo-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--promo-success-text)]">
      <Icon size={14} aria-hidden="true" />
      {text}
    </span>
  );
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<{ value: T; label: string; count: number }>;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex min-w-max items-center gap-1" role="group" aria-label="Filter promotions by status">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 ${
              selected
                ? 'bg-[var(--oppa-green)] text-white'
                : 'text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)]'
            }`}
          >
            {option.label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${selected ? 'bg-white/20 text-white' : 'bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]'}`}>
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 focus-visible:ring-offset-2 ${
        checked ? 'bg-[var(--oppa-green)]' : 'bg-slate-300'
      }`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

interface PromoModalProps {
  open: boolean;
  title: string;
  icon: IconType;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  labelledBy: string;
}

export function PromoModal({ open, title, icon: Icon, onClose, children, footer, labelledBy }: PromoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [];
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="admin-promo-backdrop fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="admin-promo-dialog flex max-h-[calc(100dvh-0.5rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
              <Icon size={20} aria-hidden="true" />
            </span>
            <h2 id={labelledBy} className="truncate font-display text-xl font-bold text-[var(--oppa-text)]">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close promotion form"
            title="Close"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--oppa-text-muted)] transition-colors duration-150 hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50"
          >
            <LuX size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-6">
          {footer}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{children}</label>;
}
