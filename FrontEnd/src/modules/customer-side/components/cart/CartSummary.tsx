// src/modules/customer-side/components/cart/CartSummary.tsx
import React from 'react';
import { formatCurrency } from '../../../../utils/formatters'; 
import { useSettings } from '../../../../contexts/SettingsContext';

interface CartSummaryProps {
  subtotal: number;
  hasItems: boolean;
  useCutlery: boolean;
  onCutleryChange: (value: boolean) => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({ subtotal, hasItems, useCutlery, onCutleryChange }) => {
  const { pricing } = useSettings();
  const vat = subtotal * pricing.vat_rate;
  const total = Math.round((subtotal + vat) * 100) / 100;

  return (
    <div className="border-t border-gray-200 bg-white rounded-b-xl">
      <div className="px-5 py-3 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-800 font-medium">{hasItems ? formatCurrency(subtotal) : '—'}</span>
        </div>
      </div>
      
      <div className="px-5 py-3 border-t border-gray-100">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            <span className="text-sm text-gray-700">Cutlery</span>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={useCutlery}
              onChange={(e) => onCutleryChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#2d6a4f] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </div>
        </label>
        {!useCutlery && (
          <p className="text-xs text-gray-400 mt-2">No cutlery provided. Thanks for reducing waste!</p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Total</span>
          <span className={`text-xl font-bold ${hasItems ? 'text-[#2d6a4f]' : 'text-gray-400'}`}>
            {hasItems ? formatCurrency(total) : '—'}
          </span>
        </div>
        <p className="text-xs text-gray-400 text-right mt-0.5">(incl. fees and tax)</p>
      </div>
    </div>
  );
};

export default CartSummary;