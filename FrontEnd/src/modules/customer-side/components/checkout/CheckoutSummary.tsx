import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiMapPin } from 'react-icons/fi';
import { LuStore } from 'react-icons/lu';
import type { CartItem } from '../../../../types/product.types';
import type { BranchResolutionDetails } from '../../../../services/branchRoutingService';
import VoucherSection from './VoucherSection';
import { useCartCalculations } from '../../../../hooks/useCartCalculations';
import { formatCurrency } from '../../../../utils/formatters';
import { calculateItemTotal } from '../../../../services/cartService';
import { useSettings } from '../../../../contexts/SettingsContext';
import { useStoreHours } from '../../../../contexts/StoreHoursContext';

interface CheckoutSummaryProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority' | 'scheduled';
  onPlaceOrder: () => void;
  onVoucherApply: (discount: number, promo?: { code: string }) => void;
  voucherDiscount: number;
  deliveryCoordinates?: { lat: number; lng: number };
  branchCoordinates?: { lat: number; lng: number };
  branchId?: string | null;
  branchName?: string;
  branchDistanceKm?: number;
  deliveryError?: BranchResolutionDetails & { code: string; message: string };
  isCheckingDelivery?: boolean;
  cartBranchName?: string;
  hasMixedCartBranches?: boolean;
  cartValidationNotice?: string;
  onPickLocation?: () => void;
  onChooseAddress?: () => void;
  onRetryDeliveryCheck?: () => void;
  onSwitchBranch?: (branchId: string, branchName: string) => void;
  onBlockedOrderClick?: () => void;
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
  branchId,
  branchName = 'Select a delivery address',
  branchDistanceKm,
  deliveryError,
  isCheckingDelivery = false,
  cartBranchName = 'your selected branch',
  hasMixedCartBranches = false,
  cartValidationNotice,
  onPickLocation,
  onChooseAddress,
  onRetryDeliveryCheck,
  onSwitchBranch,
  onBlockedOrderClick,
  canPickLocation = false,
  canPlaceOrder = false,
  isPlacingOrder = false
}) => {
  const navigate = useNavigate();
  const deliveryAlertRef = useRef<HTMLDivElement>(null);
  const { getActiveDiscount } = useSettings();
  const { status: storeHours } = useStoreHours();
  const activeDiscount = getActiveDiscount();
  const orderingClosed = storeHours?.state !== 'open';
  const hasMixedCartError = hasMixedCartBranches || deliveryError?.code === 'CART_BRANCH_MISMATCH';

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
      <div className="checkout-summary bg-white rounded-2xl shadow-lg p-6">
        <p className="text-gray-500 text-center">Your cart is empty</p>
        <button onClick={() => navigate('/customer')} className="w-full mt-4 py-2 bg-[#2d6a4f] text-white rounded-lg">
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-summary checkout-summary-panel bg-white rounded-2xl shadow-lg">
      <div className="checkout-summary-header flex shrink-0 items-center gap-2">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-800">Your order from</h2>
          {branchDistanceKm != null && <p className="mt-0.5 text-xs font-normal text-gray-500">{branchDistanceKm.toFixed(1)} km away</p>}
        </div>
      </div>

      <div className="checkout-summary-scroll min-h-0 flex-1">
        {hasMixedCartError || (deliveryError && deliveryError.code !== 'CHECKING') ? (
          <div
            ref={deliveryAlertRef}
            role="alert"
            aria-live="polite"
            className="checkout-delivery-status checkout-delivery-error"
          >
            <FiAlertCircle className="checkout-delivery-status-icon" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="checkout-delivery-status-title">
                {hasMixedCartError
                  ? 'Your cart has items from different branches'
                  : deliveryError?.code === 'OUT_OF_RANGE'
                    ? 'Address is outside our delivery area'
                    : deliveryError?.code === 'BRANCH_MISMATCH'
                      ? 'This address is served by a different branch'
                      : deliveryError?.code === 'UNAVAILABLE_ITEMS'
                        ? 'Some items are unavailable at this branch'
                        : deliveryError?.code === 'CHECKING'
                          ? 'Checking delivery availability'
                          : 'We couldn’t check delivery availability'}
              </p>
              <p className="checkout-delivery-status-message">
                {hasMixedCartError
                  ? 'Remove items that do not belong to the same branch before placing your order.'
                  : deliveryError?.code === 'OUT_OF_RANGE'
                    ? deliveryError.message
                    : deliveryError?.code === 'BRANCH_MISMATCH'
                      ? `Your cart has items from ${deliveryError.cartBranch?.name || cartBranchName}, but this address is served by ${deliveryError.servingBranch?.name || branchName}. Items from different branches can't be ordered together.`
                      : deliveryError?.message || 'Please try again.'}
              </p>
              {deliveryError?.code === 'OUT_OF_RANGE' && (
                <div className="checkout-delivery-actions">
                  <button type="button" className="checkout-delivery-action-primary" onClick={onChooseAddress}>Choose another address</button>
                  {canPickLocation && onPickLocation && <button type="button" className="checkout-delivery-action-secondary" onClick={onPickLocation}>Pin your location on the map</button>}
                </div>
              )}
              {deliveryError?.code === 'BRANCH_MISMATCH' && (
                <div className="checkout-delivery-actions">
                  {deliveryError.servingBranch?.id && deliveryError.servingBranch.name && onSwitchBranch && (
                    <button
                      type="button"
                      className="checkout-delivery-action-primary"
                      onClick={() => onSwitchBranch(deliveryError.servingBranch!.id!, deliveryError.servingBranch!.name!)}
                    >
                      Switch to {deliveryError.servingBranch.name} menu
                    </button>
                  )}
                  <button type="button" className="checkout-delivery-action-secondary" onClick={onChooseAddress}>Choose another address</button>
                </div>
              )}
              {hasMixedCartError && (
                <div className="checkout-delivery-actions">
                  <button type="button" className="checkout-delivery-action-secondary" onClick={() => navigate('/customer')}>Review cart items</button>
                </div>
              )}
              {deliveryError && !['OUT_OF_RANGE', 'BRANCH_MISMATCH', 'CART_BRANCH_MISMATCH', 'UNAVAILABLE_ITEMS', 'CHECKING'].includes(deliveryError.code) && (
                <div className="checkout-delivery-actions">
                  <button type="button" className="checkout-delivery-action-primary" onClick={onRetryDeliveryCheck}>Retry</button>
                  {canPickLocation && onPickLocation && <button type="button" className="checkout-delivery-action-secondary" onClick={onPickLocation}>Pin your location on the map</button>}
                </div>
              )}
              {deliveryError?.code === 'UNAVAILABLE_ITEMS' && (
                <div className="checkout-delivery-actions">
                  <button type="button" className="checkout-delivery-action-secondary" onClick={() => navigate('/customer')}>Review cart items</button>
                </div>
              )}
            </div>
          </div>
        ) : isCheckingDelivery || deliveryError?.code === 'CHECKING' ? (
          <div className="checkout-delivery-status checkout-delivery-neutral" role="status" aria-live="polite">
            <FiMapPin className="checkout-delivery-status-icon" aria-hidden="true" />
            <p className="checkout-delivery-status-message">Checking delivery availability…</p>
          </div>
        ) : branchDistanceKm != null ? (
          <div className="checkout-delivery-status checkout-delivery-success" role="status" aria-live="polite">
            <LuStore className="checkout-delivery-status-icon" aria-hidden="true" />
            <div>
              <p className="checkout-delivery-status-title">Delivering from {branchName}</p>
              <p className="checkout-delivery-status-message">{branchDistanceKm.toFixed(1)} km away</p>
            </div>
          </div>
        ) : (
          <div className="checkout-delivery-status checkout-delivery-neutral" role="status">
            <FiMapPin className="checkout-delivery-status-icon" aria-hidden="true" />
            <p className="checkout-delivery-status-message">Select a delivery address</p>
          </div>
        )}
        {cartValidationNotice && <div role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {cartValidationNotice}
        </div>}

        <div className="checkout-summary-items mb-4">
          {cartItems.map((item) => {
            const itemTotal = calculateItemTotal(item);
            return (
              <div key={item.id} className="checkout-summary-item text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">{item.quantity}x {item.name}</span>
                  <span className="font-medium text-gray-800">{formatCurrency(itemTotal)}</span>
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

        <VoucherSection branchId={branchId} cartItems={cartItems} onVoucherApplied={onVoucherApply} onVoucherRemoved={() => onVoucherApply(0)} />

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
        </div>
      </div>

      <div className="checkout-summary-footer shrink-0">
        {orderingClosed && (
          <p role="alert" aria-live="assertive" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {storeHours?.order_closed_message || 'Ordering status is unavailable. Please try again shortly.'}
          </p>
        )}
        <div className="checkout-total">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-[#2d6a4f]">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-right">(inc. fees and tax)</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (orderingClosed) return;
            if (!canPlaceOrder) {
              if (deliveryAlertRef.current) {
                deliveryAlertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                onBlockedOrderClick?.();
              }
              deliveryAlertRef.current?.classList.add('checkout-delivery-alert-pulse');
              window.setTimeout(() => deliveryAlertRef.current?.classList.remove('checkout-delivery-alert-pulse'), 700);
              return;
            }
            onPlaceOrder();
          }}
          disabled={isPlacingOrder || orderingClosed}
          aria-disabled={!canPlaceOrder || orderingClosed}
          className="checkout-place-order w-full rounded-xl font-semibold transition"
        >
          {isPlacingOrder ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Placing order...
            </span>
          ) : orderingClosed ? (
            'Ordering closed'
          ) : !canPlaceOrder ? (
            deliveryError?.code === 'OUT_OF_RANGE'
              ? 'Address out of delivery range'
              : deliveryError?.code === 'BRANCH_MISMATCH'
                ? `Select an address served by ${cartBranchName}`
                : hasMixedCartError
                  ? 'Remove items from different branches'
                  : !branchDistanceKm
                    ? 'Select a delivery address'
                    : 'Resolve delivery availability'
          ) : (
            'Place order'
          )}
        </button>
      </div>
    </div>
  );
};

export default CheckoutSummary;
