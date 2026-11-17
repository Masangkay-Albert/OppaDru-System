import React from 'react';
import { Outlet } from 'react-router-dom';
import { useStoreHours } from '../../../contexts/StoreHoursContext';

const StoreHoursGate: React.FC = () => {
  const { status } = useStoreHours();

  return (
    <>
      {status?.simulation_enabled && (
        <div className="flex justify-center border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-2">
          <span role="status" aria-label="Store time is simulated" className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-900">
            Simulated time
          </span>
        </div>
      )}
      {status?.state === 'last_order_passed' && (
        <aside role="status" aria-label="Ordering hours notice" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
          Last order was at {status.configured_hours.last_order}. We're closing at {status.configured_hours.closing}.
        </aside>
      )}
      {status?.state === 'closed' && (
        <aside role="status" aria-label="Ordering unavailable" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
          We're not accepting orders right now. Ordering is open daily from {status.configured_hours.opening} to {status.configured_hours.last_order}. {status.next_opening_label}
        </aside>
      )}
      <Outlet />
    </>
  );
};

export default StoreHoursGate;
