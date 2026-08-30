import React from 'react';
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
  const { pricing } = useSettings();
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
    deliveryFee = Math.max(0, Number(derived.toFixed(2)));
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
            {currentOrder.eta && currentOrder.status !== ORDER_STATUS.DELIVERED && (
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
            <span className="text-gray-700 font-mono text-xs">{currentOrder.id}</span>
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
