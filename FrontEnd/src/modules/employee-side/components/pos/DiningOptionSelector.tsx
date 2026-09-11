import React from 'react';
import { Utensils, ShoppingBag } from 'lucide-react';

interface DiningOptionSelectorProps {
  value: 'dine_in' | 'takeout';
  onChange: (value: 'dine_in' | 'takeout') => void;
}

const DiningOptionSelector: React.FC<DiningOptionSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm">
      <label className="block text-sm font-semibold text-gray-800 mb-3">
        Dining Option
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange('dine_in')}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-bold text-sm transition-all ${
            value === 'dine_in'
              ? 'bg-[var(--oppa-green)] text-white shadow-md scale-[1.02]'
              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Utensils size={18} />
          <span>Dine-in</span>
        </button>

        <button
          type="button"
          onClick={() => onChange('takeout')}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-bold text-sm transition-all ${
            value === 'takeout'
              ? 'bg-[var(--oppa-green)] text-white shadow-md scale-[1.02]'
              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          <ShoppingBag size={18} />
          <span>Takeout</span>
        </button>
      </div>
    </div>
  );
};

export default DiningOptionSelector;
