// src/modules/admin-side/components/StatCard.tsx
import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: 'default' | 'warning';
  accent?: 'green' | 'amber' | 'red';
  trend?: string;
  trendDirection?: 'up' | 'down';
  sparkline?: number[];
  context?: string;
  loading?: boolean;
  unavailable?: boolean;
}

const accents = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tone = 'default', accent = 'green', trend, trendDirection = 'up', sparkline, context, loading = false, unavailable = false }) => {
  const hasWarning = tone === 'warning' && Number(value) > 0;
  const numericValue = typeof value === 'number' ? value : Number(value);
  const [displayValue, setDisplayValue] = useState(typeof numericValue === 'number' && Number.isFinite(numericValue) ? 0 : value);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!Number.isFinite(numericValue) || reducedMotion || numericValue === 0) {
        setDisplayValue(value);
        return;
      }
      const progress = Math.min((now - start) / 500, 1);
      setDisplayValue(Math.round(numericValue * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numericValue, value]);
  const points = sparkline || [];
  const max = Math.max(...points, 1);
  const polyline = points.map((point, index) => `${(index / (points.length - 1 || 1)) * 100},${30 - (point / max) * 26}`).join(' ');
  return (
    <div className={`admin-card relative flex min-h-36 items-start justify-between overflow-hidden p-4 pb-10 sm:p-5 sm:pb-10 ${hasWarning ? 'border-red-200 bg-red-50/70' : ''}`}>
      <div className="min-w-0">
        <p className="tabular-nums text-2xl font-bold tracking-tight text-[var(--oppa-text)] sm:text-3xl">
          {loading ? <span aria-label={`Loading ${label.toLowerCase()}`} className="inline-block h-8 w-16" /> : unavailable ? '—' : displayValue}
        </p>
        <p className="mt-1 text-xs text-[var(--oppa-text-muted)] sm:text-sm">{label}</p>
        <div className="mt-3 flex min-h-5 items-center gap-1.5">
          {trend && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${trendDirection === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {trendDirection === 'up' ? '▲' : '▼'} {trend}
          </span>}
          {trend && <span className="text-[10px] text-[var(--oppa-text-muted)]">vs last week</span>}
          {!trend && context && <span className={`text-[10px] ${hasWarning ? 'font-medium text-red-800' : tone === 'warning' ? 'font-medium text-green-800' : 'text-[var(--oppa-text-muted)]'}`}>{context}</span>}
        </div>
      </div>
      <div className={`rounded-xl p-2.5 ${hasWarning ? 'bg-red-100 text-red-700' : accents[hasWarning ? 'red' : accent]}`}>
          <Icon size={21} aria-hidden="true" />
      </div>
      {points.length > 1 && <svg aria-hidden="true" viewBox="0 0 100 34" className={`absolute bottom-3 right-4 h-7 w-16 ${hasWarning ? 'text-red-500' : 'text-[var(--oppa-green)]'}`}>
          <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>}
    </div>
  );
};

export default StatCard;
