// src/modules/customer-side/components/cart/CartSummary.tsx
import React from 'react';
import { Utensils } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';

interface CartSummaryProps {
  subtotal: number;
  hasItems: boolean;
  useCutlery: boolean;
  onCutleryChange: (value: boolean) => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({ subtotal, hasItems, useCutlery, onCutleryChange }) => {
  return (
    <div className="menu-cart-summary border-t border-gray-200 bg-white">
      <div className="space-y-4 px-5 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-bold text-gray-800">{hasItems ? formatCurrency(subtotal) : '—'}</span>
        </div>

        <label className="flex min-h-10 cursor-pointer items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="size-5 text-gray-500" aria-hidden="true" />
            <span className="text-sm text-gray-700">Cutlery</span>
          </div>
          <span className="relative">
            <input
              type="checkbox"
              checked={useCutlery}
              onChange={(e) => onCutleryChange(e.target.checked)}
              aria-label="Include cutlery"
              className="peer sr-only"
            />
            <span className="menu-cutlery-switch block h-5 w-10 rounded-full bg-gray-200 transition-colors peer-checked:bg-[#2d6a4f] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2d6a4f] after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
          </span>
        </label>
        {!useCutlery && (
          <p className="-mt-2 pb-1 text-xs text-gray-400">No cutlery provided. Thanks for reducing waste!</p>
        )}
      </div>
    </div>
  );
};

export default CartSummary;