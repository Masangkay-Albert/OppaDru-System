import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../../../types/product.types';
import { formatPeso } from '../../../../utils/formatters';
import { calculateItemTotal, calculateSubtotal } from '../../../../services/cartService';
import { getThirdPartyPlatformLabel, type OrderSource } from '../../../../constants/thirdPartyPlatforms';

interface CheckoutSummaryProps {
  cartItems: CartItem[];
  onPlaceOrder: () => void;
  discountRate?: number;
  discountAmount?: number;
  promoDiscount?: number;
  promoCode?: string;
  isPlacingOrder?: boolean;
  orderSource?: OrderSource;
  externalOrderRef?: string;
  isOrderSourceValid?: boolean;
}

const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  cartItems,
  onPlaceOrder,
  discountRate = 0,
  discountAmount = 0,
  promoDiscount = 0,
  promoCode = '',
  isPlacingOrder = false,
  orderSource = 'walk_in',
  externalOrderRef = '',
  isOrderSourceValid = true,
}) => {
  const navigate = useNavigate();
  const subtotal = calculateSubtotal(cartItems);
  const hasStatutoryDiscount = discountRate > 0;
  const vatExemptBase = Math.round(subtotal / 1.12);
  const calculatedDiscount = discountAmount > 0
    ? discountAmount
    : Math.round(vatExemptBase * (discountRate || 0));
  const netBeforeTax = Math.max(0, (hasStatutoryDiscount ? vatExemptBase - calculatedDiscount : subtotal) - promoDiscount);
  const vat = hasStatutoryDiscount ? 0 : Math.round(netBeforeTax * 12 / 112 * 100) / 100;
  const finalTotal = netBeforeTax;
  const hasItems = cartItems.length > 0;
  const platformLabel = getThirdPartyPlatformLabel(orderSource);

  if (!hasItems) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20 border border-gray-100">
        <p className="text-gray-500 text-center">Register cart is empty</p>
        <button
          onClick={() => navigate('/employee')}
          className="w-full mt-4 py-2.5 bg-[var(--oppa-green)] text-white rounded-xl font-semibold hover:bg-[var(--oppa-green-dark)] transition"
        >
          Back to Register Menu
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>
      </div>

      <p className="text-xs font-semibold text-[var(--oppa-green)] uppercase tracking-wider mb-3">
        Oppa Dru Korean Fried Chicken • {platformLabel || 'Onsite'}
      </p>
      {platformLabel && (
        <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--oppa-green)]/20 bg-[var(--oppa-green-soft)] px-3 py-1 text-xs font-semibold text-[var(--oppa-green-dark)]">
          <span>{platformLabel}</span>
          {externalOrderRef && <span className="max-w-40 truncate font-mono font-medium" title={externalOrderRef}>{externalOrderRef}</span>}
        </div>
      )}

      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto divide-y divide-gray-50 pr-1">
        {cartItems.map((item) => {
          const itemTotal = calculateItemTotal(item);
          return (
            <div key={item.cartItemId} className="pt-2.5 first:pt-0 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-gray-800 font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  {item.selectedSize && (
                    <span className="text-xs text-gray-400 block">{item.selectedSize}</span>
                  )}
                </div>
                <span className="tabular-nums font-semibold text-gray-800">{formatPeso(itemTotal)}</span>
              </div>
              {item.selectedAddons && item.selectedAddons.length > 0 && (
                <div className="text-xs text-gray-500 ml-4 mt-0.5 space-y-0.5">
                  {item.selectedAddons.map((a) => (
                    <div key={a.id} className="flex justify-between text-[11px]">
                      <span>+ {a.name}</span>
                      <span className="tabular-nums">{formatPeso(Number(a.price))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate('/employee')}
        className="text-[#e76f51] text-sm font-medium mb-5 flex items-center gap-1 hover:underline"
      >
        + Add more items
      </button>

      {/* Pricing Breakdown - Strictly Onsite (No Delivery Fees) */}
      <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPeso(subtotal)}</span>
        </div>

        {calculatedDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Special Discount</span>
            <span className="tabular-nums">−{formatPeso(calculatedDiscount)}</span>
          </div>
        )}

        {promoDiscount > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Promo Discount {promoCode ? `(${promoCode})` : ''}</span>
            <span className="tabular-nums">−{formatPeso(promoDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-gray-500 text-xs">
          <span>VAT (12% inclusive)</span>
          <span className="tabular-nums">{formatPeso(vat)}</span>
        </div>

        <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
          <span>Total</span>
          <span className="tabular-nums text-[var(--oppa-green)] text-xl font-extrabold">{formatPeso(finalTotal)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPlacingOrder || !hasItems}
        className="w-full mt-6 py-3.5 bg-[var(--oppa-green)] text-white font-bold rounded-xl shadow-lg hover:bg-[var(--oppa-green-dark)] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-center text-base"
      >
        {isPlacingOrder ? 'Processing Sale...' : platformLabel ? `Confirm ${platformLabel} order` : `Charge ${formatPeso(finalTotal)}`}
      </button>
    </div>
  );
};

export default CheckoutSummary;
