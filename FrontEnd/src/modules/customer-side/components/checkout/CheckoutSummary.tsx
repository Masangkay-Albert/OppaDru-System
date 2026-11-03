import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin } from 'react-icons/fi';
import type { CartItem } from '../../../../types/product.types';
import VoucherSection from './VoucherSection';
import { useCartCalculations } from '../../../../hooks/useCartCalculations';
import { formatCurrency } from '../../../../utils/formatters';
import { calculateItemTotal } from '../../../../services/cartService';
import { useSettings } from '../../../../contexts/SettingsContext';

interface CheckoutSummaryProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority' | 'scheduled';
  onPlaceOrder: () => void;
  onVoucherApply: (discount: number, promo?: { code: string }) => void;
  voucherDiscount: number;
  deliveryCoordinates?: { lat: number; lng: number };
  branchCoordinates?: { lat: number; lng: number };
  branchName?: string;
  branchDistanceKm?: number;
  branchNotice?: string;
  cartValidationNotice?: string;
  onPickLocation?: () => void;
  canPickLocation?: boolean;
  canPlaceOrder?: boolean;
  isPlacingOrder?: boolean;
}

const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  cartItems,
  deliveryType,
  onPlaceOrder,
  onVoucherApply,
  voucherDiscount,
  deliveryCoordinates,
  branchCoordinates,
  branchName = 'Select a delivery address',
  branchDistanceKm,
  branchNotice,
  cartValidationNotice,
  onPickLocation,
  canPickLocation = false,
  canPlaceOrder = false,
  isPlacingOrder = false
}) => {
  const navigate = useNavigate();
  const { getActiveDiscount } = useSettings();
  const activeDiscount = getActiveDiscount();

  const { subtotal, deliveryFee, serviceFee, priorityFee, discountAmount, vat, total, hasItems } = useCartCalculations({
    cartItems,
    deliveryType,
    voucherDiscount,
    discount: activeDiscount.discountRate,
    deliveryCoordinates,
    originCoordinates: branchCoordinates,
  });

  if (!hasItems) {
    return (
      <div className="checkout-summary bg-white rounded-2xl shadow-lg p-6 sticky top-20">
        <p className="text-gray-500 text-center">Your cart is empty</p>
        <button onClick={() => navigate('/customer')} className="w-full mt-4 py-2 bg-[#2d6a4f] text-white rounded-lg">
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-summary bg-white rounded-2xl shadow-lg p-6 sticky top-20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Your order from</h2>
      </div>

      <p className="mb-4 text-gray-800 font-medium">{branchDistanceKm != null
        ? <>Fulfilled by: {branchName}, {branchDistanceKm.toFixed(1)} km</>
        : branchName}</p>
      {branchNotice && <div role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p>{branchNotice}</p>
        {canPickLocation && onPickLocation && <button type="button" onClick={onPickLocation} className="mt-2 inline-flex min-h-9 items-center gap-1.5 font-semibold text-[var(--oppa-green)] underline underline-offset-2"><FiMapPin aria-hidden="true" />Pin your location on the map</button>}
      </div>}
      {cartValidationNotice && <div role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {cartValidationNotice}
      </div>}

      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {cartItems.map((item) => {
          const itemTotal = calculateItemTotal(item);
          const itemDiscount = activeDiscount.discountRate > 0 ? itemTotal * activeDiscount.discountRate : 0;
          const discountedPrice = itemTotal - itemDiscount;
          return (
            <div key={item.id} className="checkout-summary-item text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">{item.quantity}x {item.name}</span>
                {activeDiscount.discountRate > 0 ? (
                  <div className="text-right">
                    <span className="text-gray-400 line-through text-xs mr-1">{formatCurrency(itemTotal)}</span>
                    <span className="font-medium text-[#2d6a4f]">{formatCurrency(discountedPrice)}</span>
                  </div>
                ) : (
                  <span className="font-medium text-gray-800">{formatCurrency(itemTotal)}</span>
                )}
              </div>
              {item.selectedAddons && item.selectedAddons.length > 0 && (
                <div className="text-xs text-gray-400 ml-4">
                  {item.selectedAddons.map(a => `+ ${a.name}`).join(', ')}
                </div>
              )}
              {item.cartIssue && (
                <p role="alert" className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  {item.cartIssue === 'unavailable'
                    ? 'Unavailable at this branch. Remove this item from your cart to continue.'
                    : `Price changed${item.currentBranchPrice != null ? ` to ${formatCurrency(item.currentBranchPrice)}` : ''}. Accept the new price from your cart before continuing.`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate('/customer')} className="checkout-add-more text-[#e76f51] text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        + Add more items
      </button>

      <VoucherSection cartItems={cartItems} onVoucherApplied={onVoucherApply} onVoucherRemoved={() => onVoucherApply(0)} />

      <div className="checkout-fees border-t border-gray-100 pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="text-gray-800">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Delivery fee</span>
            <span className="text-xs text-gray-400"></span>
          </div>
          <span className="text-gray-800">{formatCurrency(deliveryFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Service fee</span>
          <span className="text-gray-800">{formatCurrency(serviceFee)}</span>
        </div>
        {deliveryType === 'priority' && (
          <div className="flex justify-between">
            <span className="text-gray-500">Priority fee</span>
            <span className="text-gray-800">{formatCurrency(priorityFee)}</span>
          </div>
        )}
        {activeDiscount.discountRate > 0 && (
          <div className="flex justify-between text-[#2d6a4f] font-medium">
            <span>{activeDiscount.type} Discount ({(activeDiscount.discountRate * 100)}%)</span>
            <span>- {formatCurrency(discountAmount)}</span>
          </div>
        )}
        {voucherDiscount > 0 && (
          <div className="flex justify-between text-[#2d6a4f]">
            <span>Promo discount</span>
            <span>- {formatCurrency(voucherDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">VAT </span>
          <span className="text-gray-800">{formatCurrency(vat)}</span>
        </div>
        <div className="checkout-total border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-[#2d6a4f]">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-right">(inc. fees and tax)</p>
        </div>
      </div>

      <button
        onClick={onPlaceOrder}
        disabled={isPlacingOrder || !canPlaceOrder}
        className={`checkout-place-order w-full mt-6 py-3 rounded-xl font-semibold transition ${
          isPlacingOrder
            ? 'bg-gray-400 cursor-not-allowed'
            : !canPlaceOrder ? 'bg-gray-300 cursor-not-allowed text-gray-600'
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
