import React from 'react';
import oppaDeliveryIcon from '../../../../assets/oppa-dru-delivery.png';

interface MapLegendProps {
  isDelivered: boolean;
  showRoute: boolean;
  showDriver: boolean;
}

interface LegendItem {
  color?: string;
  icon?: string;
  label: string;
  type: 'line' | 'circle' | 'image';
  dashed?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ isDelivered, showRoute, showDriver }) => {
  const legendItems: LegendItem[] = [];
  if (showRoute) {
    legendItems.push({ color: 'border-[var(--oppa-green)]', label: 'Route taken', type: 'line' });
    if (!isDelivered) legendItems.push({ color: 'border-[#e76f51]', label: 'Remaining', type: 'line', dashed: true });
  }
  legendItems.push(
    { color: 'bg-[var(--oppa-surface)] border-2 border-[#e76f51]', label: 'Store', type: 'circle' },
    { color: 'bg-red-500', label: 'Destination', type: 'circle' },
  );
  if (showDriver && !isDelivered) legendItems.push({ icon: oppaDeliveryIcon, label: 'Driver', type: 'image' });

  return (
    <div className="border-t border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2.5">
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--oppa-text-muted)]">
        {legendItems.map((item) => (
          <li key={item.label} className="flex min-w-0 items-center gap-1.5">
            {item.type === 'line' && (
              <span className={`w-4 shrink-0 border-t-2 ${item.color} ${'dashed' in item && item.dashed ? 'border-dashed' : 'border-solid'}`} aria-hidden="true" />
            )}
            {item.type === 'circle' && (
              <span className={`size-3 shrink-0 rounded-full ${item.color}`} aria-hidden="true" />
            )}
            {item.type === 'image' && (
              <img src={item.icon} alt="" className="size-4 shrink-0 rounded-full border border-white bg-[var(--oppa-green)] object-contain shadow-sm" />
            )}
            <span className="whitespace-nowrap">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MapLegend;
