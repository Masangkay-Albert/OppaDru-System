import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type InlineMessageVariant = 'success' | 'error' | 'warning' | 'info';

interface InlineMessageProps {
  variant: InlineMessageVariant;
  message: React.ReactNode;
  title?: string;
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
}

const variantStyles: Record<InlineMessageVariant, { container: string; icon: string; Icon: React.ElementType }> = {
  success: {
    container: 'border-emerald-200 bg-[var(--franchise-success-bg)] text-[var(--franchise-success-text)]',
    icon: 'text-[var(--oppa-green)]',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-200 bg-[var(--franchise-danger-bg)] text-[var(--franchise-danger-text)]',
    icon: 'text-red-700',
    Icon: AlertCircle,
  },
  warning: {
    container: 'border-amber-200 bg-[var(--franchise-warning-bg)] text-[var(--franchise-warning-text)]',
    icon: 'text-amber-800',
    Icon: TriangleAlert,
  },
  info: {
    container: 'border-sky-200 bg-[var(--franchise-info-bg)] text-[var(--franchise-info-text)]',
    icon: 'text-sky-800',
    Icon: Info,
  },
};

const InlineMessage: React.FC<InlineMessageProps> = ({
  variant,
  message,
  title,
  onDismiss,
  compact = false,
  className = '',
}) => {
  const styles = variantStyles[variant];
  const Icon = styles.Icon;

  return (
    <div
      role={variant === 'success' || variant === 'info' ? 'status' : 'alert'}
      aria-live={variant === 'success' || variant === 'info' ? 'polite' : 'assertive'}
      className={`flex items-start gap-3 rounded-xl border ${compact ? 'p-2.5 text-xs' : 'p-4 text-sm'} ${styles.container} ${className}`}
    >
      <Icon className={`mt-0.5 shrink-0 ${compact ? 'size-4' : 'size-5'} ${styles.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>}
        <div className={title ? 'mt-1 leading-5' : 'leading-5'}>{message}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default InlineMessage;
