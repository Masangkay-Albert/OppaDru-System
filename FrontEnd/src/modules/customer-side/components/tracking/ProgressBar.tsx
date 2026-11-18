import React from 'react';
import { Check } from 'lucide-react';
import { ORDER_STATUS } from '../../../../utils/constants';

interface ProgressBarProps {
  status: string;
  progress: number;
}

const steps = [
  { label: 'Order placed' },
  { label: 'Preparing' },
  { label: 'Prepared' },
  { label: 'On the way' },
  { label: 'Delivered' },
];

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
  const getCurrentStep = () => {
    switch (status) {
      case ORDER_STATUS.PENDING: return 0;
      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.PREPARING: return 1;
      case ORDER_STATUS.PREPARED:
      case ORDER_STATUS.READY: return 2;
      case ORDER_STATUS.ON_WAY:
      case ORDER_STATUS.ARRIVING:
      case ORDER_STATUS.ARRIVED: return 3;
      case ORDER_STATUS.DELIVERED:
      case ORDER_STATUS.COMPLETED: return 4;
      default: return 0;
    }
  };

  const currentStep = getCurrentStep();
  const isDelivered = status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED;
  const fillProgress = isDelivered ? 100 : Math.min(100, Math.max(0, progress));
  const stepState = (index: number) => index < currentStep || (isDelivered && index === currentStep)
    ? 'complete'
    : index === currentStep ? 'current' : 'upcoming';
  const dot = (index: number) => {
    const state = stepState(index);
    return (
      <span className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
        state === 'complete'
          ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white'
          : state === 'current'
            ? 'border-[var(--oppa-green)] bg-[var(--oppa-surface)] text-[var(--oppa-green)] ring-4 ring-[var(--oppa-green)]/15'
            : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)]'
      }`}>
        {state === 'complete' ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
        {state === 'current' ? <span className="size-2 rounded-full bg-[var(--oppa-green)]" aria-hidden="true" /> : null}
      </span>
    );
  };

  return (
    <div role="group" aria-label="Order progress" className="w-full">
      <ol aria-label="Order status steps" className="md:hidden">
        {steps.map((step, index) => {
          const state = stepState(index);
          const isLast = index === steps.length - 1;
          return (
            <li key={step.label} aria-current={index === currentStep ? 'step' : undefined} className="relative flex h-10 items-center gap-3">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-5 h-10 w-0.5 ${index < currentStep || (isDelivered && index === currentStep) ? 'bg-[var(--oppa-green)]' : 'bg-[var(--oppa-border)]'}`}
                  aria-hidden="true"
                />
              )}
              {dot(index)}
              <span className={`text-sm ${state === 'upcoming' ? 'text-[var(--oppa-text-muted)]' : 'font-semibold text-[var(--oppa-text)]'}`}>
                {step.label}
                {state === 'current' && <span className="sr-only">, current step</span>}
                {state === 'complete' && <span className="sr-only">, completed</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <ol aria-label="Order status steps" className="relative hidden min-h-[76px] grid-cols-5 items-start md:grid">
        <li className="absolute left-[10%] right-[10%] top-3 z-0 h-1 list-none overflow-hidden rounded-full bg-[var(--oppa-border)]" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--oppa-green)] transition-[width] duration-500" style={{ width: `${fillProgress}%` }} />
        </li>
        {steps.map((step, index) => {
          const state = stepState(index);
          return (
            <li key={step.label} aria-current={index === currentStep ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
              {dot(index)}
              <span className={`max-w-full px-1 text-xs leading-tight lg:text-sm ${state === 'upcoming' ? 'text-[var(--oppa-text-muted)]' : 'font-semibold text-[var(--oppa-text)]'}`}>
                {step.label}
                {state === 'current' && <span className="sr-only">, current step</span>}
                {state === 'complete' && <span className="sr-only">, completed</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ProgressBar;
