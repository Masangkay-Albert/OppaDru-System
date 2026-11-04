import React from 'react';
import { EmptyState } from '../../admin-side/components/AdminUI';

export const MetricCard = ({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  detail: string;
}) => (
  <div className="admin-card min-h-36 p-4 sm:p-5">
    <div className="flex items-center gap-2 text-[var(--oppa-green-dark)]">
      {icon}
      <span className="text-sm font-medium text-[var(--oppa-text-muted)]">{label}</span>
    </div>
    <p className="mt-5 text-3xl font-bold tabular-nums text-[var(--oppa-text)]">{value}</p>
    <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{detail}</p>
  </div>
);

export const TopProductCard = ({
  title,
  products,
  emptyDescription = 'No product sales in this filter.',
}: {
  title: string;
  products: Array<[string, number, string?]>;
  emptyDescription?: string;
}) => {
  const max = Math.max(...products.map(([, quantity]) => quantity), 1);
  const ranks = ['bg-amber-300 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950'];

  return (
    <div className="admin-card h-full p-5">
      <p className="text-sm font-semibold text-[var(--oppa-text)]">{title}</p>
      {products.length === 0 ? (
        <EmptyState title="No product sales" description={emptyDescription} />
      ) : (
        <ol className="mt-4 space-y-3">
          {products.map(([name, quantity, detail], index) => (
            <li key={name} className="flex items-center gap-3">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ranks[index] || 'bg-slate-100 text-slate-600'}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span title={name} className="min-w-0 truncate text-sm font-medium text-[var(--oppa-text)]">{name}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--oppa-text-muted)]">{quantity} sold</span>
                </div>
                {detail && <p className="mt-0.5 text-[11px] text-[var(--oppa-text-muted)]">{detail}</p>}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]">
                  <div className="h-full rounded-full bg-[var(--oppa-green)] transition-[width] duration-500" style={{ width: `${(quantity / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
