import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return <div className={`w-full space-y-6 ${className}`}>{children}</div>;
}

interface PageHeaderProps {
  icon: IconType;
  title: string;
  subtitle: string;
  action?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{subtitle}</p>
        </div>
      </div>
      {action}
    </header>
  );
}
