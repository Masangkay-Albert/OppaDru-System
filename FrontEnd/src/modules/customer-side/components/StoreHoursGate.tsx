import React from 'react';
import { Outlet } from 'react-router-dom';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import { useStoreHours } from '../../../contexts/StoreHoursContext';

const StoreClosedPage: React.FC<{
  opening: string;
  closing: string;
  nextOpeningLabel: string;
}> = ({ opening, closing, nextOpeningLabel }) => (
  <main className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-4 py-10">
    <section role="status" aria-labelledby="store-closed-title" className="w-full max-w-lg rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 text-center shadow-lg sm:p-10">
      <img src={oppaDruLogo} alt="Oppa Dru Korean Fried Chicken" className="mx-auto mb-6 h-auto w-36 object-contain" />
      <h1 id="store-closed-title" className="font-serif text-3xl font-bold text-[var(--oppa-text)] sm:text-4xl">We're currently closed</h1>
      <p className="mt-4 text-base text-[var(--oppa-text-muted)]">We're open daily from {opening} to {closing}.</p>
      <p className="mt-3 rounded-xl bg-[var(--oppa-green-soft)] px-4 py-3 text-sm font-semibold text-[var(--oppa-highlight-text)]">{nextOpeningLabel}</p>
    </section>
  </main>
);

const StoreHoursGate: React.FC = () => {
  const { status, isLoading } = useStoreHours();

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--oppa-cream)] px-4" role="status" aria-live="polite">Checking store hours…</main>;
  }

  if (!status) {
    return <main className="grid min-h-screen place-items-center bg-[var(--oppa-cream)] px-4 text-center text-sm text-[var(--oppa-text-muted)]" role="alert">Store availability is temporarily unavailable. Please try again shortly.</main>;
  }

  if (status.state === 'closed') {
    return (
      <StoreClosedPage
        opening={status.configured_hours.opening}
        closing={status.configured_hours.closing}
        nextOpeningLabel={status.next_opening_label}
      />
    );
  }

  return (
    <>
      {status.state === 'last_order_passed' && (
        <aside role="status" aria-label="Ordering hours notice" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
          Last order was at {status.configured_hours.last_order}. We're closing at {status.configured_hours.closing}.
        </aside>
      )}
      <Outlet />
    </>
  );
};

export default StoreHoursGate;
