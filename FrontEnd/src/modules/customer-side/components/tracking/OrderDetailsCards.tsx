import React, { useEffect } from 'react';
import type { Order } from '../../../../contexts/OrderContext';
import type { CartItem, Addon } from '../../../../types/product.types';
import { getPaymentMethodLabel } from '../../../../constants/thirdPartyPlatforms';
import { formatCurrency } from '../../../../utils/formatters';
import { normalizeOrderStatus } from '../../../../utils/orderManagement';
import { useSettings } from '../../../../contexts/SettingsContext';

export type OrderDetailsSection = 'driver' | 'items' | 'branch' | 'address' | 'information';

interface OrderDetailsCardsProps {
  currentOrder: Order;
  formatDate: (date: Date | string) => string;
  sections?: OrderDetailsSection[];
}

const cardClass = 'rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-card';
const headingClass = 'mb-3 font-serif text-lg font-semibold text-[var(--oppa-text)]';

const OrderDetailsCards: React.FC<OrderDetailsCardsProps> = ({ currentOrder, formatDate, sections }) => {
  const { pricing, refreshPricing } = useSettings();
  const visibleSections = sections ?? ['driver', 'items', 'branch', 'address', 'information'];
  const hasSection = (section: OrderDetailsSection) => visibleSections.includes(section);
  const shouldRefreshPricing = hasSection('items');

  useEffect(() => {
    if (!shouldRefreshPricing) return;
    void refreshPricing().catch((error: unknown) => {
      console.error('Unable to load pricing settings for order details.', error);
    });
  }, [refreshPricing, shouldRefreshPricing]);

  const subtotal = currentOrder.items?.reduce((sum: number, item: CartItem) => {
    const addonsTotal = item.selectedAddons?.reduce((total: number, addon: Addon) => total + Number(addon.price || 0), 0) || 0;
    return sum + (item.price * item.quantity) + addonsTotal;
  }, 0) || 0;

  const serviceFee = Number(currentOrder.serviceFee ?? pricing.service_fee ?? 0);
  let priorityFee = Number(currentOrder.priorityFee ?? 0);
  let vat = Number(currentOrder.vat ?? 0);
  let deliveryFee = Number(currentOrder.deliveryFee ?? pricing.delivery_fee_standard ?? 0);

  if (priorityFee === 0 && currentOrder.deliveryType === 'priority') {
    priorityFee = 99;
  }

  if (deliveryFee === 0 && currentOrder.total > 0) {
    const derived = currentOrder.total - subtotal - serviceFee - priorityFee - vat;
    deliveryFee = Math.max(0, Math.round(derived));
  }

  if (vat === 0 && currentOrder.total > 0) {
    const beforeVat = subtotal + deliveryFee + serviceFee + priorityFee;
    vat = Math.round((currentOrder.total - beforeVat) * 100) / 100;
    if (vat < 0) vat = 0;
  }

  const hasPriorityFee = currentOrder.deliveryType === 'priority' || priorityFee > 0;
  const orderStatus = normalizeOrderStatus(currentOrder.status);
  const isDelivered = ['delivered', 'completed'].includes(orderStatus);
  const hasAssignedDriver = Boolean(currentOrder.driver || currentOrder.driverId || currentOrder.driver_id);
  const branchLabel = isDelivered
    ? 'Fulfilled by'
    : orderStatus === 'preparing'
      ? 'Preparing at'
      : ['prepared', 'ready', 'on_the_way', 'on_way', 'arriving', 'arrived'].includes(orderStatus)
        ? 'Prepared at'
        : 'Branch';

  return (
    <div className="space-y-4">
      {hasSection('driver') && hasAssignedDriver && (
        <section className={`${cardClass} border-[var(--oppa-green)]/25`} aria-labelledby="tracking-driver-title">
          <h2 id="tracking-driver-title" className={headingClass}>
            {isDelivered ? 'Delivered by' : 'Assigned delivery driver'}
          </h2>
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--oppa-green)] text-lg font-bold text-white">
              {currentOrder.driver?.name?.charAt(0).toUpperCase() || 'D'}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--oppa-text)]">{currentOrder.driver?.name || 'Assigned driver'}</p>
              {(currentOrder.driver?.vehicleType || currentOrder.driver?.vehicle_type) && (
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">
                  {currentOrder.driver?.vehicleType || currentOrder.driver?.vehicle_type}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {hasSection('items') && (
        <section className={cardClass} aria-labelledby="tracking-items-title">
          <h2 id="tracking-items-title" className={headingClass}>Order Items</h2>
          {currentOrder.replacementOfOrderId && (
            <p className="mb-3 rounded-xl border border-[var(--oppa-green)]/20 bg-[var(--oppa-green-soft)] px-3 py-2 text-xs font-semibold text-[var(--oppa-available-text)]">
              Replacement · Original order {currentOrder.originalOrderNumber || currentOrder.replacementOfOrderId}
            </p>
          )}
          <div className="mb-3 max-h-56 space-y-3 overflow-y-auto">
            {currentOrder.items?.map((item: CartItem, index: number) => {
              const addonsTotal = item.selectedAddons?.reduce((total: number, addon: Addon) => total + Number(addon.price || 0), 0) || 0;
              const itemTotal = (item.price * item.quantity) + addonsTotal;
              return (
                <div key={index} className="py-1 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium text-[var(--oppa-text)]">{item.quantity}x {item.name}</span>
                    <span className="shrink-0 font-medium text-[var(--oppa-text)]">{formatCurrency(itemTotal)}</span>
                  </div>
                  {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="mt-1 space-y-0.5 pl-3">
                      {item.selectedAddons.map((addon) => (
                        <div key={addon.id} className="flex justify-between gap-3 text-xs text-[var(--oppa-text-muted)]">
                          <span className="min-w-0 break-words">+ {addon.name}</span>
                          <span className="shrink-0">{formatCurrency(addon.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <p className="mt-1 break-words pl-3 text-xs italic text-[var(--oppa-text-muted)]">&ldquo;{item.specialInstructions}&rdquo;</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-[var(--oppa-border)] pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[var(--oppa-text-muted)]">Subtotal</span>
              <span className="shrink-0 text-right text-[var(--oppa-text)]">{formatCurrency(subtotal)}</span>
            </div>
            {(currentOrder.promoDiscount || 0) > 0 && (
              <div className="flex justify-between gap-3 text-[var(--oppa-green)]">
                <span className="min-w-0 truncate">Promo{currentOrder.promoCode ? ` (${currentOrder.promoCode})` : ''}</span>
                <span className="shrink-0 font-medium">−{formatCurrency(currentOrder.promoDiscount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-[var(--oppa-text-muted)]">Delivery fee</span>
              <span className="shrink-0 text-right text-[var(--oppa-text)]">{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--oppa-text-muted)]">Service fee</span>
              <span className="shrink-0 text-right text-[var(--oppa-text)]">{formatCurrency(serviceFee)}</span>
            </div>
            {hasPriorityFee && (
              <div className="flex justify-between gap-3">
                <span className="text-[var(--oppa-text-muted)]">Priority fee</span>
                <span className="shrink-0 text-right text-[var(--oppa-text)]">{formatCurrency(priorityFee)}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-[var(--oppa-text-muted)]">VAT (12%)</span>
              <span className="shrink-0 text-right text-[var(--oppa-text)]">{formatCurrency(vat)}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--oppa-border)] pt-3">
            <div className="flex justify-between gap-3 text-lg font-bold text-[var(--oppa-green)]">
              <span>Total</span>
              <span className="shrink-0">{formatCurrency(currentOrder.total)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-[var(--oppa-text-muted)]">(including fees and tax)</p>
          </div>
        </section>
      )}

      {hasSection('branch') && (
        <section className={cardClass} aria-labelledby="tracking-branch-title">
          <h2 id="tracking-branch-title" className={headingClass}>{branchLabel}</h2>
          <p className="break-words text-sm text-[var(--oppa-text)]">{currentOrder.branchName || 'Assigned branch'}</p>
        </section>
      )}

      {hasSection('address') && (
        <section className={cardClass} aria-labelledby="tracking-address-title">
          <h2 id="tracking-address-title" className={headingClass}>Delivery Address</h2>
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]" aria-hidden="true">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm leading-6 text-[var(--oppa-text)]">{currentOrder.deliveryAddress || currentOrder.address}</p>
              {currentOrder.eta && !['delivered', 'completed', 'cancelled', 'failed'].includes(orderStatus) && (
                <p className="mt-1 text-xs font-medium text-[var(--promo-warning-text)]">ETA: {currentOrder.eta} minutes</p>
              )}
            </div>
          </div>
        </section>
      )}

      {hasSection('information') && (
        <section className={cardClass} aria-labelledby="tracking-information-title">
          <h2 id="tracking-information-title" className={headingClass}>Order Information</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-[var(--oppa-text-muted)]">Placed</dt>
              <dd className="text-right font-medium text-[var(--oppa-text)]">{formatDate(currentOrder.timestamp)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-[var(--oppa-text-muted)]">Payment method</dt>
              <dd className="text-right font-medium text-[var(--oppa-text)]">
                {currentOrder.replacementOfOrderId
                  ? 'Replacement (no charge)'
                  : getPaymentMethodLabel(currentOrder.paymentMethod)}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
};

export default OrderDetailsCards;
