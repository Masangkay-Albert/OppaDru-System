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
          <span className="text-[15px] font-medium text-gray-600">Subtotal</span>
          <span className="text-[15px] font-bold text-gray-800">{hasItems ? formatCurrency(subtotal) : '—'}</span>
        </div>

        <label className="flex min-h-[68px] cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-[#dfe6df] bg-[#f6f4f1] px-3 py-2.5 transition hover:border-[#cfe1d2] hover:bg-[#f3f5f0]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#dfeee5] text-[#276343] shadow-inner shadow-[#eaf6ee]">
              <Utensils className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold leading-none text-gray-800">Cutlery</span>
              <span className="mt-1 block text-[12px] text-gray-500">{useCutlery ? 'Included with your order' : 'No cutlery requested'}</span>
            </span>
          </div>
          <span className="relative inline-flex h-7 w-[52px] shrink-0 items-center">
            <input
              type="checkbox"
              checked={useCutlery}
              onChange={(e) => onCutleryChange(e.target.checked)}
              aria-label="Include cutlery with my order"
              role="switch"
              className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
            />
            <span aria-hidden="true" className="menu-cutlery-switch pointer-events-none" />
          </span>
        </label>
      </div>
    </div>
  );
};

export default CartSummary;