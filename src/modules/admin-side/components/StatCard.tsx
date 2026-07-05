// src/modules/admin-side/components/StatCard.tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: 'default' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tone = 'default' }) => {
  const iconBg =
    tone === 'warning' ? 'bg-red-100 text-red-600' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]';

  return (
    <div className="hover-oppa-transition flex items-center justify-between rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xl font-bold text-[var(--oppa-text)] sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs text-[var(--oppa-text-muted)] sm:text-sm">{label}</p>
      </div>
      <div className={`rounded-xl p-2.5 sm:p-3 ${iconBg}`}>
        <Icon size={20} className="sm:hidden" />
        <Icon size={22} className="hidden sm:block" />
      </div>
    </div>
  );
};

export default StatCard;
