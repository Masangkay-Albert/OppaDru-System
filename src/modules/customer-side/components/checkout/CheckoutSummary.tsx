// src/modules/customer-side/components/checkout/CheckoutSummary.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../../../types/product.types';
import VoucherSection from './VoucherSection';
import { useCartCalculations } from '../../../../hooks/useCartCalculations';
import { formatCurrency } from '../../../../utils/formatters';
import { calculateItemTotal } from '../../../../services/cartService'; 

interface CheckoutSummaryProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority';
  onPlaceOrder: () => void;
  onVoucherApply: (discount: number) => void;
  voucherDiscount: number;
  isPlacingOrder?: boolean;
}

const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ 
  cartItems, 
  deliveryType, 
  onPlaceOrder,
  onVoucherApply,
  voucherDiscount,
  isPlacingOrder = false
}) => {
  const navigate = useNavigate();
  const { subtotal, deliveryFee, serviceFee, vat, total, hasItems } = useCartCalculations({
    cartItems,
    deliveryType,
    voucherDiscount
  });

  // Don't return null, always show something
  if (!hasItems) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20">
        <p className="text-gray-500 text-center">Your cart is empty</p>
        <button onClick={() => navigate('/customer')} className="w-full mt-4 py-2 bg-[#2d6a4f] text-white rounded-lg">
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Your order from</h2>
      </div>
      
      <p className="text-gray-800 font-medium mb-4">Oppa Dru Korean Fried Chicken</p>

      {/* Order Items */}
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {cartItems.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">{item.quantity}x {item.name}</span>
              <span className="font-medium text-gray-800">{formatCurrency(calculateItemTotal(item))}</span>
            </div>
            {item.selectedAddons && item.selectedAddons.length > 0 && (
              <div className="text-xs text-gray-400 ml-4">
                {item.selectedAddons.map(a => `+ ${a.name}`).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/customer')} className="text-[#e76f51] text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        + Add more items
      </button>

      <VoucherSection subtotal={subtotal} onVoucherApplied={onVoucherApply} onVoucherRemoved={() => onVoucherApply(0)} />

      {/* Price Summary */}
      <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-800">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Delivery fee</span>
          <span className="text-gray-800">{deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Service fee</span>
          <span className="text-gray-800">{formatCurrency(serviceFee)}</span>
        </div>
        {voucherDiscount > 0 && (
          <div className="flex justify-between text-[#2d6a4f]">
            <span>Voucher discount</span>
            <span>- {formatCurrency(voucherDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">VAT (12%)</span>
          <span className="text-gray-800">{formatCurrency(vat)}</span>
        </div>
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-[#2d6a4f]">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-right">(inc. fees and tax)</p>
        </div>
      </div>

      <button 
        onClick={onPlaceOrder} 
        disabled={isPlacingOrder}
        className={`w-full mt-6 py-3 rounded-xl font-semibold transition ${
          isPlacingOrder 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-[#2d6a4f] text-white hover:bg-[#1b4d3e]'
        }`}
      >
        {isPlacingOrder ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          'Place order'
        )}
      </button>
    </div>
  );
};

export default CheckoutSummary;