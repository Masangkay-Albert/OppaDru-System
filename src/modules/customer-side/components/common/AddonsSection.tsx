// AddonsSection.tsx
import React from 'react';

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface AddonsSectionProps {
  addons: Addon[];
  selectedAddons: Addon[];
  onToggleAddon: (addon: Addon) => void;
}

const AddonsSection: React.FC<AddonsSectionProps> = ({ 
  addons, 
  selectedAddons, 
  onToggleAddon 
}) => {
  if (addons.length === 0) return null;

  return (
    <div className="mb-5">
      <label className="block font-semibold text-sm text-gray-800 mb-2">Add-ons</label>
      <div className="flex flex-col gap-2">
        {addons.map((addon) => (
          <label key={addon.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-[#d8f3dc] transition-colors">
            <input
              type="checkbox"
              checked={selectedAddons.some(a => a.id === addon.id)}
              onChange={() => onToggleAddon(addon)}
              className="w-4 h-4 cursor-pointer accent-[#2d6a4f]"
            />
            <span className="flex-1 text-sm font-medium text-gray-800">{addon.name}</span>
            <span className="text-xs font-semibold text-[#e76f51]">+ ₱{addon.price}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default AddonsSection;