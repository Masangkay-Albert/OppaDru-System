import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, MoreHorizontal, PackageCheck } from 'lucide-react';
import { getProductImage } from '../../../data/productImages';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import SearchInput from '../../../components/ui/SearchInput';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)] sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{subtitle}</p>}
    </div>
    {actions}
  </header>
);

export const FilterBar: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <section aria-label="Filters" className={`admin-card p-4 ${className}`}>{children}</section>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, icon, action }) => (
  <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
    <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
      {icon || <PackageCheck size={23} aria-hidden="true" />}
    </div>
    <h3 className="font-semibold text-[var(--oppa-text)]">{title}</h3>
    {description && <p className="max-w-md text-sm text-[var(--oppa-text-muted)]">{description}</p>}
    {action}
  </div>
);

export const Toast: React.FC<{
  message: string;
  tone?: 'success' | 'error';
  onDismiss: () => void;
}> = ({ message, tone = 'success', onDismiss }) => {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 3500);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`admin-toast fixed bottom-5 right-5 z-[150] flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${tone === 'error' ? 'admin-toast--error' : 'admin-toast--success'}`}>
    <Icon size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{message}</span>
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="ml-2 rounded p-0.5 hover:bg-black/5">×</button>
  </div>;
};

export const ConfirmDialog: React.FC<{
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ title, description, confirmLabel = 'Delete', onConfirm, onCancel, busy = false }) => {
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelStateRef = useRef({ onCancel, busy });

  useEffect(() => {
    cancelStateRef.current = { onCancel, busy };
  }, [onCancel, busy]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelStateRef.current.busy) {
        cancelStateRef.current.onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
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
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/50 p-4 backdrop-blur-[4px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section ref={(element) => { dialogRef.current = element; }} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertCircle size={22} aria-hidden="true" /></div>
        <h2 id="confirm-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">{title}</h2>
        <p id="confirm-description" className="mt-2 text-sm text-[var(--oppa-text-muted)]">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{busy ? 'Removing…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
};

const badgeMap: Record<string, { label: string; style: string }> = {
  active: { label: 'Active', style: 'bg-emerald-100 text-emerald-800' },
  assigned: { label: 'Assigned', style: 'bg-emerald-100 text-emerald-800' },
  inactive: { label: 'Inactive', style: 'bg-slate-200 text-slate-800' },
  available: { label: 'Available', style: 'bg-emerald-100 text-emerald-800' },
  out_of_stock: { label: 'Out of stock', style: 'bg-red-100 text-red-800' },
  delivered: { label: 'Delivered', style: 'bg-emerald-100 text-emerald-800' },
  pending: { label: 'Pending', style: 'bg-amber-100 text-amber-900' },
  prepared: { label: 'Prepared', style: 'bg-purple-100 text-purple-900' },
  preparing: { label: 'Preparing', style: 'bg-blue-100 text-blue-900' },
  ready: { label: 'Ready', style: 'bg-blue-100 text-blue-900' },
  on_the_way: { label: 'On the way', style: 'bg-indigo-100 text-indigo-900' },
  on_theway: { label: 'On the way', style: 'bg-indigo-100 text-indigo-900' },
  scheduled: { label: 'Scheduled', style: 'bg-orange-100 text-orange-900' },
  cancelled: { label: 'Cancelled', style: 'bg-red-100 text-red-900' },
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const fallbackLabel = status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const badge = badgeMap[normalized] || { label: fallbackLabel, style: 'bg-slate-100 text-slate-800' };
  return <span className={`admin-status-badge admin-status-badge--${normalized} franchise-status-badge franchise-status-badge--${normalized} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.style}`}>
    <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />{badge.label}
  </span>;
};

export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const colors = ['bg-emerald-700', 'bg-sky-700', 'bg-violet-700', 'bg-amber-700', 'bg-rose-700', 'bg-teal-700'];
  const color = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
  return <span aria-hidden="true" className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${colors[color]} ${className}`}>{initials}</span>;
};

export const ProductThumbnail: React.FC<{
  src?: string | null;
  name: string;
  className?: string;
  overlay?: React.ReactNode;
}> = ({ src, name, className = '', overlay }) => {
  const imageSrc = getProductImage(src || '');
  const [failedSrc, setFailedSrc] = useState('');
  const fallbackSrc = oppaDruLogo;
  const displayedSrc = failedSrc === imageSrc ? fallbackSrc : imageSrc;

  return <span className={`group/product-image relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--oppa-green-soft)] ${className}`}>
    <img
      src={displayedSrc}
      alt={name}
      onError={() => {
        if (displayedSrc !== fallbackSrc) setFailedSrc(imageSrc);
      }}
      className="size-full object-cover"
    />
    {overlay}
  </span>;
};

export const AvailabilitySwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  activeText?: string;
  inactiveText?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, activeText = 'Available', inactiveText = 'Unavailable', disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={checked ? activeText : inactiveText}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'bg-green-600' : 'bg-[var(--oppa-border)]'}`}
  >
    <span aria-hidden="true" className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

export const RowActionsMenu: React.FC<{
  label: string;
  items: Array<{ label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean; title?: string }>;
}> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const showMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const menuHeight = Math.min(items.length * 40 + 8, window.innerHeight - 16);
    const top = bounds.bottom + menuHeight + 8 <= window.innerHeight
      ? bounds.bottom + 4
      : Math.max(8, bounds.top - menuHeight - 4);
    setPosition({ top, right: Math.max(8, window.innerWidth - bounds.right) });
    setOpen((value) => !value);
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeMenu = () => setOpen(false);
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [open]);
  return <div ref={root} className="relative inline-flex">
    <button type="button" aria-label={`Actions for ${label}`} aria-haspopup="menu" aria-expanded={open} title="More actions" onClick={showMenu} className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--oppa-border)] text-[var(--oppa-text-muted)] transition-all duration-200 ease-out hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2"><MoreHorizontal size={18} /></button>
    {open && position && createPortal(
      <div ref={menuRef} role="menu" aria-label={`${label} actions`} style={{ top: position.top, right: position.right }} className="fixed z-[200] min-w-44 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1 shadow-xl">
        {items.map((item) => <button key={item.label} role="menuitem" type="button" title={item.title} disabled={item.disabled} onClick={(event) => { event.stopPropagation(); setOpen(false); item.onSelect(); }} className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45 ${item.destructive ? 'text-red-700 hover:bg-red-50' : 'text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]'}`}>{item.label}</button>)}
      </div>,
      document.body,
    )}
  </div>;
};

const formatAdminDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
};

export const AdminDate: React.FC<{ value?: string | null }> = ({ value }) => {
  if (!value) return <span>N/A</span>;
  const date = new Date(value);
  const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  return <time dateTime={value} title={time ? `${formatAdminDate(value)} · ${time}` : value} className="whitespace-nowrap">{formatAdminDate(value)}{time && <span className="mt-0.5 block text-xs text-[var(--oppa-text-muted)]">{time}</span>}</time>;
};

export const DataTable: React.FC<React.PropsWithChildren<{
  headers: string[];
  className?: string;
  columnWidths?: string[];
  columnAlignments?: Array<'left' | 'center' | 'right'>;
  caption: string;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  sortControl?: React.ReactNode;
  pagination?: { page: number; pageCount: number; onPageChange: (page: number) => void };
  emptyState?: React.ReactNode;
  loading?: boolean;
}>> = ({ headers, className = '', columnWidths, columnAlignments, caption, children, search, sortControl, pagination, emptyState, loading = false }) => {
  const hasRows = React.Children.toArray(children).length > 0;
  const alignmentClass = (index: number) => {
    const alignment = columnAlignments?.[index];
    return alignment ? `col-${alignment}` : '';
  };
  return <section className={className}>
    {(search || sortControl) && <div className="mb-3 flex flex-col gap-3 sm:flex-row">
      {search && <SearchInput aria-label={search.placeholder || 'Search table'} value={search.value} onChange={search.onChange} placeholder={search.placeholder || 'Search…'} wrapperClassName="min-w-0 flex-1" />}
      {sortControl}
    </div>}
    <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-[var(--shadow-card)]">
      <table className={`admin-table w-full text-sm ${columnWidths ? 'table-fixed' : ''} ${columnAlignments ? 'data-table' : ''}`}>
        <caption className="sr-only">{caption}</caption>
        {columnWidths && <colgroup>{columnWidths.map((width, index) => <col key={`${index}-${width}`} style={{ width }} />)}</colgroup>}
        <thead><tr className="sticky top-0 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/70 text-left text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
          {headers.map((header, index) => <th scope="col" data-column={header} key={header} className={`${alignmentClass(index)} px-4 py-3 ${header === 'Total' || header === 'Total spent' || header === 'Date' ? 'text-right' : ''}`}>{header}</th>)}
        </tr></thead>
        <tbody aria-busy={loading}>{loading ? <tr><td colSpan={headers.length}><span className="sr-only">Loading table</span></td></tr> : children}</tbody>
      </table>
      {!loading && !hasRows && <div className="border-t border-[var(--oppa-border)]">{emptyState || <EmptyState title="No results found" description="Try changing your search or filters." />}</div>}
    </div>
    {pagination && pagination.pageCount > 1 && <nav aria-label="Table pages" className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)} className="rounded-lg border border-[var(--oppa-border)] p-2 text-[var(--oppa-text)] disabled:opacity-40"><ChevronLeft size={16} /></button>
      <span className="tabular-nums text-[var(--oppa-text-muted)]">Page {pagination.page} of {pagination.pageCount}</span>
      <button type="button" aria-label="Next page" disabled={pagination.page >= pagination.pageCount} onClick={() => pagination.onPageChange(pagination.page + 1)} className="rounded-lg border border-[var(--oppa-border)] p-2 text-[var(--oppa-text)] disabled:opacity-40"><ChevronRight size={16} /></button>
    </nav>}
  </section>;
};
