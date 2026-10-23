import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface CashierPageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const CashierPageHeader: React.FC<CashierPageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}) => (
  <header className="cashier-page-header cashier-surface">
    <div className="min-w-0">
      <p className="cashier-page-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {subtitle && <p className="cashier-page-subtitle">{subtitle}</p>}
      {children}
    </div>
    {actions && <div className="cashier-page-actions">{actions}</div>}
  </header>
);

interface CashierStatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export const CashierStatCard: React.FC<CashierStatCardProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  className = '',
  loading = false,
}) => (
  <article className={`cashier-stat-card cashier-surface ${className}`} aria-busy={loading}>
    {loading ? (
      <>
        <span className="cashier-stat-icon animate-pulse" aria-hidden="true" />
        <div className="cashier-stat-copy w-full" role="status" aria-label={`Loading ${label}`}>
          <span className="cashier-stat-skeleton cashier-stat-skeleton-label" />
          <span className="cashier-stat-skeleton cashier-stat-skeleton-value" />
          <span className="cashier-stat-skeleton cashier-stat-skeleton-detail" />
        </div>
      </>
    ) : (
      <>
        <span className="cashier-stat-icon"><Icon size={19} aria-hidden="true" /></span>
        <div className="cashier-stat-copy">
          <p>{label}</p>
          <strong>{value}</strong>
          {detail && <small>{detail}</small>}
        </div>
      </>
    )}
  </article>
);
