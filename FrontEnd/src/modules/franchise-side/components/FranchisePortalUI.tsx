import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const roleLabel = (role: string) => {
  const normalized = role.trim().toLowerCase().replaceAll('_', ' ');
  if (normalized === 'kitchen staff') return 'Kitchen Staff';
  if (normalized === 'franchise manager') return 'Manager';
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
};

const roleTone = (role: string) => {
  const normalized = role.trim().toLowerCase().replaceAll('_', ' ');
  if (normalized.includes('owner')) return 'franchise-role-badge--owner';
  if (normalized.includes('manager')) return 'franchise-role-badge--manager';
  if (normalized.includes('driver')) return 'franchise-role-badge--driver';
  if (normalized.includes('kitchen')) return 'franchise-role-badge--kitchen';
  return 'franchise-role-badge--cashier';
};

export const RoleBadge: React.FC<{ role: string; className?: string }> = ({ role, className = '' }) => (
  <span className={`franchise-role-badge ${roleTone(role)} ${className}`}>{roleLabel(role)}</span>
);

const statusTone = (status: string) => {
  if (['rejected', 'withdrawn'].includes(status)) return 'bg-red-50 text-red-800';
  if (['approved', 'active'].includes(status)) return 'bg-emerald-50 text-emerald-800';
  if (['for_interview', 'conditionally_approved', 'for_final_evaluation', 'approved_for_opening', 'agreement_pending', 'requirements_pending'].includes(status)) return 'bg-blue-50 text-blue-800';
  if (status === 'location_assessment') return 'bg-violet-50 text-violet-800';
  if (status === 'on_hold') return 'bg-stone-100 text-stone-700';
  return 'bg-amber-50 text-amber-900';
};

export const FranchiseStatusPill: React.FC<{ status: string; label?: string; compact?: boolean }> = ({ status, label, compact = false }) => (
  <span className={`franchise-status-badge inline-flex w-fit items-center gap-2 rounded-full border font-semibold ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${statusTone(status)}`}>
    <span className="size-2 rounded-full bg-current" aria-hidden="true" />{label || franchiseStatusLabel(status)}
  </span>
);

export const FranchiseStepper: React.FC<{ status: string; hidden?: boolean }> = ({ status, hidden }) => {
  if (hidden) return null;
  const activeIndex = franchiseStageIndex({ status });
  const approved = status === 'approved';
  return <section aria-label="Application progress" className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
    <h2 className="mb-3 font-serif text-lg font-semibold">Franchise process</h2>
    <ol className="franchise-application-stepper">{FRANCHISE_APPLICATION_STAGES.map((stage, index) => {
      const complete = index < activeIndex || (approved && index === activeIndex);
      const current = index === activeIndex;
      return <li key={stage.status} aria-current={current ? 'step' : undefined} className={`franchise-step ${approved && current ? 'is-approved' : current ? 'is-current' : complete ? 'is-complete' : ''}`}>
        <span className="franchise-step-marker">{complete ? <Check size={15} aria-label={approved && current ? 'Approved' : 'Completed'} /> : index + 1}</span>
        <span className="franchise-step-copy"><strong>{stage.label}</strong><small>{approved && current ? 'Approved' : current ? `Current: ${franchiseStatusLabel(status)}` : complete ? 'Completed' : 'Next stage'}</small></span>
      </li>;
    })}</ol>
  </section>;
};

export type FranchiseTimelineEvent = { id: string | number; title: string; message?: string | null; created_at: string };
const formatTimestamp = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(value));

export const FranchiseTimeline: React.FC<{ events?: FranchiseTimelineEvent[] | null; emptyMessage?: string }> = ({ events, emptyMessage = 'No timeline updates yet.' }) => (
  <section className="franchise-timeline-section">
    <h3 className="mb-3 font-serif text-lg font-semibold">Application timeline</h3>
    {!events?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">{emptyMessage}</p> : <ol className="franchise-timeline space-y-4">{events.map((event) => <li key={event.id} className="relative pl-6">
      <span className="franchise-timeline-point" aria-hidden="true" /><p className="text-sm font-semibold">{event.title}</p>
      {event.message && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[var(--oppa-text-muted)]">{event.message}</p>}
      <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{formatTimestamp(event.created_at)}</p>
    </li>)}</ol>}
  </section>
);

export const FranchiseEmptyState: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center shadow-sm">
    <AlertCircle className="mx-auto size-9 text-[var(--oppa-green)]" aria-hidden="true" />
    <h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{description}</p>{action && <div className="mt-5">{action}</div>}
  </section>
);

export const FranchiseSkeleton: React.FC<{ rows?: number; label?: string }> = ({ rows = 2, label = 'Loading applications' }) => (
  <div className="space-y-4" role="status" aria-label={label}>
    <span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, index) => <div key={index} className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm">
      <div className="h-3 w-32 animate-pulse rounded bg-stone-200" /><div className="mt-3 h-6 w-2/3 animate-pulse rounded bg-stone-200" /><div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-stone-100" /><div className="mt-7 h-28 animate-pulse rounded-2xl bg-stone-100" />
    </div>)}</div>
);
