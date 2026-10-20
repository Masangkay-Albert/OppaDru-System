import React from 'react';
import { Store } from 'lucide-react';

interface StaffBranchBadgeProps {
  name: string;
  id?: string | null;
}

const StaffBranchBadge: React.FC<StaffBranchBadgeProps> = ({ name, id }) => (
  <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 py-1.5 text-xs font-semibold text-[var(--oppa-text)]">
    <Store size={14} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
    <span className="truncate">{name}</span>
    {id && <span className="hidden shrink-0 text-[var(--oppa-text-muted)] sm:inline">{id}</span>}
  </span>
);

export default StaffBranchBadge;
