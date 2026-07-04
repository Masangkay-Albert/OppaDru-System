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
  const iconBg = tone === 'warning' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <Icon size={22} />
      </div>
    </div>
  );
};

export default StatCard;
