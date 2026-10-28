import React, { useEffect } from 'react';
import { ORDER_STATUS } from '../../../../utils/constants';
import type { Order } from '../../../../contexts/OrderContext';
import type { CartItem, Addon } from '../../../../types/product.types';
import { formatCurrency } from '../../../../utils/formatters';
import { useSettings } from '../../../../contexts/SettingsContext';

interface OrderDetailsCardsProps {
  currentOrder: Order;
  formatDate: (date: Date | string) => string;
}

const OrderDetailsCards: React.FC<OrderDetailsCardsProps> = ({ currentOrder, formatDate }) => {
  const { pricing, refreshPricing } = useSettings();

  useEffect(() => {
    void refreshPricing().catch((error: unknown) => {
      console.error('Unable to load pricing settings for order details.', error);
    });
  }, [refreshPricing]);
  const subtotal = currentOrder.items?.reduce((sum: number, item: CartItem) => {
    const addonsTotal = item.selectedAddons?.reduce((s: number, a: Addon) => s + Number(a.price || 0), 0) || 0;
    return sum + (item.price * item.quantity) + addonsTotal;
  }, 0) || 0;

  const serviceFee = Number(currentOrder.serviceFee ?? pricing.service_fee ?? 0);
  let priorityFee = Number(currentOrder.priorityFee ?? 0);
  let vat = Number(currentOrder.vat ?? 0);
  let deliveryFee = Number(currentOrder.deliveryFee ?? pricing.delivery_fee_standard ?? 0);

  // If priority fee is missing but delivery type is priority, set it to 99
  if (priorityFee === 0 && currentOrder.deliveryType === 'priority') {
    priorityFee = 99;
  }

  // If the saved delivery fee is stale/zero, derive it from the total and known fees.
  if (deliveryFee === 0 && currentOrder.total > 0) {
    const derived = currentOrder.total - subtotal - serviceFee - priorityFee - vat;
    deliveryFee = Math.max(0, Math.round(derived));
  }

  // If VAT is 0 or missing, recalculate from total
  if (vat === 0 && currentOrder.total > 0) {
    const beforeVat = subtotal + deliveryFee + serviceFee + priorityFee;
    vat = Math.round((currentOrder.total - beforeVat) * 100) / 100;
    if (vat < 0) vat = 0; // Safety check
  }

  const hasPriorityFee = currentOrder.deliveryType === 'priority' || priorityFee > 0;

  return (
    <div className="space-y-4">
      {currentOrder.driver && (
        <div className="bg-gradient-to-br from-[#f0f9f4] to-white rounded-2xl shadow-lg p-5 border border-[#2d6a4f]/25 transition-all">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2d6a4f] animate-pulse"></span>
              Assigned Delivery Driver
            </h3>
            <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#d8f3dc] text-[#1c3d2e] tracking-wide uppercase">
              Order Accepted
            </span>
          </div>

          <div className="flex items-center gap-3.5 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2d6a4f] to-[#1b4332] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 border border-white/20">
              {currentOrder.driver.name ? currentOrder.driver.name.charAt(0).toUpperCase() : 'D'}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-gray-900 truncate">
                {currentOrder.driver.name || 'Assigned Driver'}
              </h4>

              <div className="mt-1 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-gray-600">
                {currentOrder.driver.vehicleType && (
                  <span className="inline-flex items-center gap-1 font-semibold bg-gray-100 px-2 py-0.5 rounded-md text-gray-700">
                    <svg className="w-3.5 h-3.5 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    Vehicle: {currentOrder.driver.vehicleType}
                  </span>
                )}

                {currentOrder.driver.phone && (
                  <a
                    href={`tel:${currentOrder.driver.phone}`}
                    className="inline-flex items-center gap-1 text-[#2d6a4f] hover:underline font-bold"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {currentOrder.driver.phone}
                  </a>
                )}
              </div>
            </div>

            {currentOrder.driver.phone && (
              <a
                href={`tel:${currentOrder.driver.phone}`}
                className="w-10 h-10 rounded-xl bg-[#2d6a4f] hover:bg-[#1b4332] text-white flex items-center justify-center transition-transform hover:scale-105 shadow-sm shrink-0"
                title={`Call driver ${currentOrder.driver.name}`}
                aria-label={`Call driver ${currentOrder.driver.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Order Items</h3>
        <div className="space-y-3 max-h-56 overflow-y-auto mb-3">
          {currentOrder.items?.map((item: CartItem, idx: number) => {
            const addonsTotal = item.selectedAddons?.reduce((s: number, a: Addon) => s + Number(a.price || 0), 0) || 0;
            const itemTotal = (item.price * item.quantity) + addonsTotal;
            return (
              <div key={idx} className="text-sm py-1 border-b border-gray-100 last:border-0">
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">{item.quantity}x {item.name}</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(itemTotal)}</span>
                </div>

                {item.selectedAddons && item.selectedAddons.length > 0 && (
                  <div className="mt-1 pl-3 space-y-0.5">
                    {item.selectedAddons.map((addon) => (
                      <div key={addon.id} className="flex justify-between text-xs text-gray-400">
                        <span>+ {addon.name}</span>
                        <span>{formatCurrency(addon.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {item.specialInstructions && (
                  <p className="text-xs text-gray-400 italic pl-3 mt-1">"{item.specialInstructions}"</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-800">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Delivery fee</span>
            <span className="text-gray-800">{formatCurrency(deliveryFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Service fee</span>
            <span className="text-gray-800">{formatCurrency(serviceFee)}</span>
          </div>
          {hasPriorityFee && (
            <div className="flex justify-between">
              <span className="text-gray-500">Priority fee</span>
              <span className="text-gray-800">{formatCurrency(priorityFee)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">VAT (12%)</span>
            <span className="text-gray-800">{formatCurrency(vat)}</span>
          </div>
        </div>

        <div className="border-t border-[#e76f51]/20 pt-3 mt-2">
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="text-[#2d6a4f]">{formatCurrency(currentOrder.total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-right">(inc. fees and tax)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-2">Preparing at</h3>
        <p className="text-sm text-gray-700">{currentOrder.branchName || 'Assigned branch'}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Delivery Address</h3>
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">{currentOrder.deliveryAddress || currentOrder.address}</p>
            {currentOrder.eta && !['delivered', 'completed', 'cancelled', 'failed'].includes(String(currentOrder.status)) && (
              <p className="text-xs text-[#e76f51] mt-1">ETA: {currentOrder.eta} minutes</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Order Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Order ID</span>
            <span className="text-gray-700 font-mono text-xs">{currentOrder.orderNumber || currentOrder.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Placed</span>
            <span className="text-gray-700 font-medium">{formatDate(currentOrder.timestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method</span>
            <span className="text-gray-700 font-medium">
              {currentOrder.paymentMethod?.replace('_', ' ').toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={`font-medium ${
              currentOrder.status === ORDER_STATUS.DELIVERED ? 'text-[#2d6a4f]' :
              currentOrder.status === ORDER_STATUS.ON_THE_WAY ? 'text-[#e76f51]' :
              'text-[#ca8a04]'
            }`}>
              {currentOrder.status?.charAt(0).toUpperCase() + currentOrder.status?.slice(1) || 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsCards;
