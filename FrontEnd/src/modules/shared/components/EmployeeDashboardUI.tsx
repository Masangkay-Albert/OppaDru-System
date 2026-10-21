import React from 'react';
import { ArrowDownUp, ChefHat, ChevronDown, ClipboardList, LogOut, Store, Truck, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type EmployeeDashboardRole = 'kitchen' | 'driver';

const roleStyles: Record<EmployeeDashboardRole, {
  label: string;
  icon: LucideIcon;
  badge: string;
}> = {
  kitchen: {
    label: 'Kitchen',
    icon: ChefHat,
    badge: 'bg-[var(--employee-kitchen)] text-white',
  },
  driver: {
    label: 'Driver',
    icon: Truck,
    badge: 'bg-[var(--employee-driver)] text-white',
  },
};

interface EmployeeDashboardLayoutProps {
  role: EmployeeDashboardRole;
  branchName: string;
  branchId?: string | null;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const EmployeeDashboardLayout: React.FC<EmployeeDashboardLayoutProps> = ({
  role,
  branchName,
  branchId,
  onSignOut,
  children,
}) => {
  const roleStyle = roleStyles[role];
  const RoleIcon = roleStyle.icon;

  return (
    <div className="employee-dashboard-background flex min-h-screen flex-col">
      <header className="employee-dashboard-header sticky top-0 z-30 border-b border-[var(--oppa-border)] shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[var(--employee-container-max)] items-center justify-between gap-1 px-4 sm:gap-3 sm:px-6 lg:px-10 2xl:px-14">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="font-serif text-base font-bold tracking-tight text-[var(--oppa-green)] sm:text-xl">Oppa Dru</span>
            <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider sm:h-7 sm:gap-1.5 sm:px-3 sm:text-[11px] ${roleStyle.badge}`}>
              <RoleIcon size={13} aria-hidden="true" />
              {roleStyle.label}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <span title={branchName} className="inline-flex h-8 min-w-0 max-w-[28vw] items-center gap-1.5 truncate rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-[11px] font-medium text-[var(--oppa-text)] sm:h-9 sm:max-w-[min(42vw,16rem)] sm:gap-2 sm:px-3 sm:text-xs">
              <Store size={14} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
              <span className="truncate">{branchName}</span>
              {branchId && <span className="hidden shrink-0 text-[var(--oppa-text-muted)] sm:inline">{branchId}</span>}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-xs font-medium text-[var(--oppa-text-muted)] transition-all duration-200 ease-out hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[var(--employee-container-max)] flex-1 flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pt-8 2xl:px-14">
        {children}
      </main>
    </div>
  );
};

export const EmployeeDashboardHeader: React.FC<{
  title: string;
  name: string;
  subtitle?: string;
  context?: React.ReactNode;
}> = ({ title, name, subtitle, context }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-serif text-3xl font-bold leading-tight tracking-[-0.035em] text-[var(--oppa-text)] sm:text-4xl lg:text-[2.625rem]">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">{subtitle}</p>}
    </div>
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {context}
      <span className="inline-flex h-10 max-w-full shrink-0 items-center gap-2 rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-xs shadow-sm">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[10px] font-bold uppercase text-[var(--oppa-highlight-text)]">
          {name.trim().charAt(0) || <UserRound size={12} aria-hidden="true" />}
        </span>
        <span className="text-[var(--oppa-text-muted)]">Logged in as</span>
        <span className="max-w-[min(45vw,16rem)] truncate font-medium text-[var(--oppa-text)]">{name}</span>
      </span>
    </div>
  </div>
);

export interface EmployeeDashboardTab<T extends string> {
  id: T;
  label: string;
  count?: React.ReactNode;
}

export const EmployeeDashboardTabs = <T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: EmployeeDashboardTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}) => (
  <div className="admin-scrollbar inline-flex min-h-11 max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        aria-pressed={activeTab === tab.id}
        onClick={() => onChange(tab.id)}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 ${
          activeTab === tab.id
            ? 'bg-[var(--oppa-green)] text-white shadow-sm'
            : 'text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-text)]'
        }`}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-highlight-text)]'}`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

export const EmployeeDashboardSort = <T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
}) => (
  <label className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)] shadow-sm transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-green-500/40 focus-within:ring-offset-2">
    <ArrowDownUp size={15} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
    <span className="whitespace-nowrap font-medium">Sort by:</span>
    <span className="relative inline-flex min-w-0 items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-w-0 cursor-pointer appearance-none bg-transparent py-1 pr-5 font-semibold text-[var(--oppa-text)] outline-none"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-0 text-[var(--oppa-text-muted)]" aria-hidden="true" />
    </span>
  </label>
);

export const EmployeeDashboardEmptyState: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-8 text-center shadow-sm sm:p-12">
    <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
      <ClipboardList size={24} aria-hidden="true" />
    </span>
    <p className="font-semibold text-[var(--oppa-text)]">{title}</p>
    <p className="mt-2 max-w-md text-sm text-[var(--oppa-text-muted)]">{description}</p>
  </div>
);
