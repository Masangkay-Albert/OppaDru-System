//src/modules/customer-side/components/common/AddonsSection.tsx
import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { getAddonImage } from '../../../../data/productImages';
import type { Addon, AddonGroup } from '../../../../types/product.types';
import { formatCurrency } from '../../../../utils/formatters';

interface AddonsSectionProps {
  group: AddonGroup;
  selectedAddons: Addon[];
  onToggleAddon: (addon: Addon) => void;
  initialVisibleCount?: number;
}

const AddonsSection: React.FC<AddonsSectionProps> = ({
  group,
  selectedAddons,
  onToggleAddon,
  initialVisibleCount = 3,
}) => {
  const [showAll, setShowAll] = useState(false);

  const availableAddons = group.addons.filter((addon) => addon.is_available !== false && addon.is_active !== false);
  if (availableAddons.length === 0) return null;

  const visibleAddons = showAll ? availableAddons : availableAddons.slice(0, initialVisibleCount);
  const remainingCount = availableAddons.length - initialVisibleCount;

  return (
    <div className="mb-5">
      <label className="block font-semibold text-sm text-gray-800 mb-2">{group.name}</label>
      <div className="flex flex-col gap-2">
        {visibleAddons.map((addon) => (
          <label
            key={addon.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-[#d8f3dc] transition-colors"
          >
            <input
              checked={selectedAddons.some((a) => a.id === addon.id)}
              type={group.selection_type === 'single' ? 'radio' : 'checkbox'}
              onChange={() => onToggleAddon(addon)}
              className="w-4 h-4 cursor-pointer accent-[#2d6a4f] shrink-0"
            />
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0">
              <img
                src={getAddonImage(addon.image)}
                alt={addon.name}
                onError={(event) => {
                  event.currentTarget.src = getAddonImage('');
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">{addon.name}</span>
            <span className="text-xs font-semibold text-[#e76f51] shrink-0">+ {formatCurrency(addon.price)}</span>
          </label>
        ))}
      </div>

      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#2d6a4f] hover:underline"
        >
          {showAll ? (
            <>
              <FiChevronUp className="text-sm" />
              Show less
            </>
          ) : (
            <>
              <FiChevronDown className="text-sm" />
              View {remainingCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default AddonsSection;