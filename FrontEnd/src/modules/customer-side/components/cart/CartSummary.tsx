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

        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-100 bg-[#fbfaf7] px-3 py-2 transition hover:border-[#d7e5d8]">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e7f1e8] text-[#276343]">
              <Utensils className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-800">Cutlery</span>
              <span className="block text-xs text-gray-500">{useCutlery ? 'Included with your order' : 'No cutlery requested'}</span>
            </span>
          </div>
          <span className="relative inline-flex h-6 w-11 shrink-0">
            <input
              type="checkbox"
              checked={useCutlery}
              onChange={(e) => onCutleryChange(e.target.checked)}
              aria-label="Include cutlery with my order"
              role="switch"
              className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
            />
            <span aria-hidden="true" className="menu-cutlery-switch pointer-events-none relative block h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-[#276343] after:absolute after:left-[3px] after:top-[3px] after:size-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-[20px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#276343]" />
          </span>
        </label>
      </div>
    </div>
  );
};

export default CartSummary;