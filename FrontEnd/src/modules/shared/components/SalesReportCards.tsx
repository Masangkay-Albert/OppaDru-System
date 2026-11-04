import React from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { EmptyState } from '../../admin-side/components/AdminUI';
import { formatCurrency } from '../../../utils/formatters';

export interface SalesTrendBucket {
  label: string;
  sales: number;
  orders: number;
}

export const ReportFilterCard = ({
  children,
  className = '',
}: React.PropsWithChildren<{ className?: string }>) => (
  <section aria-label="Report filters" className={`admin-reports-filters admin-card p-4 ${className}`}>
    {children}
  </section>
);

export const SalesTotalCard = ({
  label,
  amount,
  trendBuckets,
}: {
  label: string;
  amount: number;
  trendBuckets: SalesTrendBucket[];
}) => {
  const maxSales = Math.max(...trendBuckets.map(({ sales }) => sales), 1);
  const points = trendBuckets.map((bucket, index) => (
    `${(index / Math.max(trendBuckets.length - 1, 1)) * 100},${23 - (bucket.sales / maxSales) * 20}`
  )).join(' ');

  return (
    <div className="admin-card admin-card--brand relative min-h-36 overflow-hidden p-5 text-white">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <TrendingUp size={18} aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{formatCurrency(amount)}</p>
      <p className="mt-1 text-xs text-white/75">Based on selected filters</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">Current selection</span>
        <svg aria-label="Sales trend for selected period" role="img" viewBox="0 0 100 25" className="h-6 w-20 text-white/90">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
};

export interface SalesTargetCardProps {
  savedGoal: number;
  goalInput: string;
  sales: number;
  goalReached: boolean;
  goalSet: boolean;
  editing: boolean;
  saving: boolean;
  error: string;
  onGoalChange: (value: string) => void;
  onSave: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClear: () => void;
}

export const SalesTargetCard: React.FC<SalesTargetCardProps> = ({
  savedGoal,
  goalInput,
  sales,
  goalReached,
  goalSet,
  editing,
  saving,
  error,
  onGoalChange,
  onSave,
  onStartEdit,
  onCancelEdit,
  onClear,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const numericInput = Number(goalInput);
  const isInputValid = !Number.isNaN(numericInput) && numericInput > 0;
  const isDirty = goalSet ? isInputValid && numericInput !== savedGoal : isInputValid;
  const progress = goalSet ? Math.min(Math.round((sales / savedGoal) * 100), 100) : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if ((!goalSet || editing) && isInputValid && (!goalSet || isDirty)) onSave();
    } else if (event.key === 'Escape' && editing) {
      onCancelEdit();
    }
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${!goalSet ? 'admin-card' : goalReached ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--oppa-text)]">Sales target</p>
          <p className={`mt-1 text-xs font-medium ${!goalSet ? 'text-[var(--oppa-text-muted)]' : goalReached ? 'text-green-700' : 'text-red-700'}`}>
            {!goalSet ? 'No target set' : goalReached ? 'Profit target reached' : 'Below profit target'}
          </p>
        </div>
        <TrendingUp size={19} className={!goalSet ? 'text-[var(--oppa-text-muted)]' : goalReached ? 'text-green-600' : 'text-red-600'} />
      </div>

      <div className="mt-4 flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)] focus-within:border-[var(--oppa-green)]">
          ₱<input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={goalSet && !editing ? savedGoal.toLocaleString('en-PH') : goalInput}
            onChange={(event) => onGoalChange(event.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={handleKeyDown}
            disabled={goalSet && !editing}
            placeholder="Set target"
            aria-label="Sales target in Philippine pesos"
            className="admin-embedded-input min-w-0 w-full px-1 py-2 text-sm text-[var(--oppa-text)] disabled:cursor-not-allowed"
          />
        </label>

        {!goalSet ? (
          <button type="button" onClick={onSave} disabled={saving || !isInputValid} className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        ) : !editing ? (
          <button type="button" onClick={onStartEdit} disabled={saving} className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50">Edit</button>
        ) : (
          <div className="flex gap-1.5">
            <button type="button" onClick={onSave} disabled={saving || !isInputValid || !isDirty} className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Update'}
            </button>
            <button type="button" onClick={onCancelEdit} disabled={saving} className="rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2.5 py-2 text-xs font-medium text-[var(--oppa-text-muted)] transition hover:bg-slate-50">Cancel</button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-[var(--oppa-text-muted)]">Sales: {formatCurrency(sales)} / Target: {formatCurrency(savedGoal)}</p>
        {goalSet && <button type="button" onClick={onClear} disabled={saving} className="text-xs font-medium text-[var(--oppa-text-muted)] underline transition hover:text-[var(--oppa-text)] disabled:opacity-50">Remove</button>}
      </div>

      {goalSet && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--oppa-text-muted)]">Target progress</span>
            <span className="font-bold tabular-nums text-[var(--oppa-text)]">{Math.round((sales / savedGoal) * 100)}%</span>
          </div>
          <div role="progressbar" aria-label="Sales target reached" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round((sales / savedGoal) * 100), 100)} className="h-2.5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]">
            <div className={`h-full rounded-full transition-[width] duration-700 ${goalReached ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-right text-xs text-[var(--oppa-text-muted)]">Remaining <strong className="tabular-nums text-[var(--oppa-text)]">{formatCurrency(Math.max(savedGoal - sales, 0))}</strong></p>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
};

export const SalesChannelCard = ({
  onlineOrders,
  onlineSales,
  onsiteOrders,
  onsiteSales,
}: {
  onlineOrders: number;
  onlineSales: number;
  onsiteOrders: number;
  onsiteSales: number;
}) => {
  const totalSales = onlineSales + onsiteSales;
  const onlineShare = totalSales > 0 ? Math.round((onlineSales / totalSales) * 100) : 0;
  const onsiteShare = Math.max(0, 100 - onlineShare);

  return (
    <section className="admin-card h-full">
      <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Channel performance</h2>
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Revenue contribution for the selected filters</p>
        </div>
        <BarChart3 size={19} className="text-[var(--oppa-green-dark)]" aria-hidden="true" />
      </div>
      <div className="space-y-4 p-5">
        <div role="img" aria-label={`Online ${onlineShare} percent, Onsite ${onsiteShare} percent`} className="flex h-5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]">
          <div className="h-full rounded-l-full bg-[var(--oppa-green)] transition-[width] duration-500" style={{ width: `${onlineShare}%` }} />
          <div className="h-full rounded-r-full bg-amber-500 transition-[width] duration-500" style={{ width: `${onsiteShare}%` }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium text-[var(--oppa-text)]"><span className="size-2.5 rounded-full bg-[var(--oppa-green)]" />Online</span>
            <span className="text-right text-xs tabular-nums text-[var(--oppa-text-muted)]">{onlineOrders} orders · {formatCurrency(onlineSales)} · {onlineShare}%</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium text-[var(--oppa-text)]"><span className="size-2.5 rounded-full bg-amber-500" />Onsite</span>
            <span className="text-right text-xs tabular-nums text-[var(--oppa-text-muted)]">{onsiteOrders} orders · {formatCurrency(onsiteSales)} · {onsiteShare}%</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export const SalesTimelineCard = ({
  buckets,
  orderCount,
  description,
  style,
  onStyleChange,
}: {
  buckets: SalesTrendBucket[];
  orderCount: number;
  description: string;
  style: 'line' | 'bar';
  onStyleChange: (style: 'line' | 'bar') => void;
}) => {
  const maxSales = Math.max(...buckets.map(({ sales }) => sales), 1);
  const peak = Math.max(...buckets.map(({ sales }) => sales), 0);

  return (
    <section className="admin-card">
      <div className="flex flex-col gap-3 border-b border-[var(--oppa-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Sales timeline</h2>
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--oppa-green-dark)]">Peak: {formatCurrency(peak)}</span>
          <div className="flex rounded-lg border border-[var(--oppa-border)] p-0.5" aria-label="Timeline chart style">
            {(['line', 'bar'] as const).map((chartStyle) => (
              <button
                key={chartStyle}
                type="button"
                aria-pressed={style === chartStyle}
                onClick={() => onStyleChange(chartStyle)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize ${style === chartStyle ? 'bg-[var(--oppa-green)] text-white' : 'text-[var(--oppa-text-muted)]'}`}
              >
                {chartStyle}
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--oppa-text-muted)]">{orderCount} {orderCount === 1 ? 'order' : 'orders'}</span>
        </div>
      </div>
      <div className="w-full overflow-x-auto p-5">
        {buckets.some(({ orders }) => orders > 0) ? (
          <svg
            role="img"
            aria-label="Sales and order timeline"
            viewBox={`0 0 ${Math.max(760, buckets.length * 58)} 230`}
            className="h-[250px] min-w-[760px] w-full"
          >
            {(() => {
              const width = Math.max(760, buckets.length * 58);
              const left = 68;
              const right = width - 18;
              const top = 24;
              const bottom = 176;
              const xAt = (index: number) => left + (index * (right - left)) / Math.max(buckets.length - 1, 1);
              const yAt = (sales: number) => bottom - (sales / maxSales) * (bottom - top);
              const line = buckets.map((bucket, index) => `${xAt(index)},${yAt(bucket.sales)}`).join(' ');
              return (
                <>
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = bottom - fraction * (bottom - top);
                    return (
                      <g key={fraction}>
                        <line x1={left} x2={right} y1={y} y2={y} stroke="var(--oppa-border)" strokeDasharray="4 5" />
                        <text x={left - 8} y={y + 4} textAnchor="end" fill="var(--oppa-text-muted)" fontSize="10">{formatCurrency(maxSales * fraction)}</text>
                      </g>
                    );
                  })}
                  <line x1={left} x2={left} y1={top} y2={bottom} stroke="var(--oppa-border)" />
                  <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--oppa-border)" />
                  {style === 'line' && (
                    <>
                      <polygon points={`${left},${bottom} ${line} ${right},${bottom}`} fill="rgba(38,122,67,.10)" />
                      <polyline points={line} fill="none" stroke="#267a43" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  )}
                  {style === 'bar' && buckets.map((bucket, index) => {
                    const step = (right - left) / Math.max(buckets.length, 1);
                    const barHeight = (bucket.sales / maxSales) * (bottom - top);
                    return (
                      <rect key={`bar-${bucket.label}`} x={left + index * step + step * 0.2} y={bottom - barHeight} width={Math.max(2, step * 0.6)} height={barHeight} rx="4" fill="#267a43">
                        <title>{`${bucket.label} · ${formatCurrency(bucket.sales)} · ${bucket.orders} ${bucket.orders === 1 ? 'order' : 'orders'}`}</title>
                      </rect>
                    );
                  })}
                  {buckets.map((bucket, index) => (
                    <g key={bucket.label}>
                      {style === 'line' && (
                        <circle
                          cx={xAt(index)}
                          cy={yAt(bucket.sales)}
                          r={bucket.sales === peak && peak > 0 ? 5 : 3.5}
                          fill={bucket.sales === peak && peak > 0 ? '#e0a800' : '#267a43'}
                          stroke="var(--oppa-surface)"
                          strokeWidth="2"
                        >
                          <title>{`${bucket.label} · ${formatCurrency(bucket.sales)} · ${bucket.orders} ${bucket.orders === 1 ? 'order' : 'orders'}`}</title>
                        </circle>
                      )}
                      <text x={xAt(index)} y="199" textAnchor="middle" fill="var(--oppa-text-muted)" fontSize="10">{bucket.label.split('\n')[0]}</text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        ) : (
          <EmptyState title="No sales for these filters" description="The timeline will show revenue and order activity when sales are available." />
        )}
      </div>
    </section>
  );
};

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
