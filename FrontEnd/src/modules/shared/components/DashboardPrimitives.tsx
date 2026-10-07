import React from 'react';
import { CalendarDays, Clock3, UserRound } from 'lucide-react';
import { getOrderStatusClasses, getOrderStatusLabel } from '../../../utils/dashboardOrders';

export const UserChip: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--oppa-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--oppa-text)] shadow-sm">
    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[10px] font-bold uppercase text-[var(--oppa-green)]">
      {name.trim().charAt(0) || <UserRound size={12} />}
    </span>
    <span className="text-[var(--oppa-text-muted)]">Logged in as</span>
    <span>{name}</span>
  </span>
);

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const borderClasses: Record<string, string> = {
    pending: 'border-amber-300',
    preparing: 'border-blue-300',
    on_the_way: 'border-purple-300',
    arrived: 'border-green-300',
    delivered: 'border-emerald-300',
    completed: 'border-emerald-300',
    cancelled: 'border-red-300',
    canceled: 'border-red-300',
    prepared: 'border-purple-300',
    ready: 'border-orange-300',
    scheduled: 'border-orange-300'
  };
  const dotClasses: Record<string, string> = {
    pending: 'bg-amber-600',
    preparing: 'bg-blue-600',
    on_the_way: 'bg-purple-600',
    arrived: 'bg-green-700',
    delivered: 'bg-stone-600',
    completed: 'bg-stone-600',
    cancelled: 'bg-red-600',
    canceled: 'bg-red-600',
    prepared: 'bg-purple-600',
    ready: 'bg-orange-600',
    scheduled: 'bg-orange-600'
  };

  return (
    <span className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${borderClasses[status.toLowerCase()] || 'border-gray-300'} ${getOrderStatusClasses(status)}`}>
      <span className={`size-1.5 rounded-full ${dotClasses[status.toLowerCase()] || 'bg-gray-500'}`} />
      {getOrderStatusLabel(status)}
    </span>
  );
};

export const OrderDateTime: React.FC<{ date: string; stacked?: boolean }> = ({ date, stacked = false }) => {
  if (!date) return <span className="text-[var(--oppa-text-muted)]">Unknown date</span>;
  const parsedDate = new Date(date);
  return (
    <span className={`inline-flex whitespace-nowrap ${stacked ? 'flex-col gap-0.5' : 'flex-col gap-0.5 xl:flex-row xl:items-center xl:gap-2'}`}>
      <span className="inline-flex items-center gap-1.5 text-[var(--oppa-text)]">
        <CalendarDays size={13} className="text-[var(--oppa-text-muted)]" />
        {parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]">
        <Clock3 size={13} />
        {parsedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
      </span>
    </span>
  );
};
