import React from 'react';
import {
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiTrash2,
} from 'react-icons/fi';
import { ORDER_STATUS } from '../../../../utils/constants';
import type { Order } from '../../../../contexts/OrderContext';
import {
  formatOrderDate,
  formatOrderTime,
  formatPaymentMethod,
  getCustomerOrderGroup,
  getCustomerOrderStatusLabel,
  getScheduledOrderDetails,
} from '../../../../utils/orderUtils';
import {
  canCancelOrder,
  getOrderCancellationRemainingSeconds,
  ORDER_CANCELLATION_WINDOW_SECONDS,
} from '../../../../utils/orderManagement';
import { formatCurrency } from '../../../../utils/formatters';

interface OrderCardProps {
  order: Order;
  isExpanded: boolean;
  onToggleDetails: (orderId: string) => void;
  onTrack: (orderId: string, event: React.MouseEvent) => void;
  onCancel: (order: Order) => void;
  onEdit: (order: Order) => void;
  onReorder: (order: Order) => void;
  orderingClosed: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isExpanded,
  onToggleDetails,
  onTrack,
  onCancel,
  onReorder,
  orderingClosed,
}) => {
  const scheduleDetails = getScheduledOrderDetails(order);
  const statusGroup = getCustomerOrderGroup(order);
  const isFinal = statusGroup !== 'active';
  const isScheduledOrder = scheduleDetails.isScheduled && !isFinal;
  const displayStatus = getCustomerOrderStatusLabel(order);
  const isActive = statusGroup === 'active';
  const isDelivered = statusGroup === 'delivered';
  const displayOrderNumber = order.orderNumber || order.id;
  const branchName = order.branchName || order.branch_name || order.branch?.name || 'Branch unavailable';

  return (
    <article className="order-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300" data-status-group={statusGroup}>
      <div className="p-5">
        <div className="order-card-header">
          <div className="min-w-0">
            <div className="order-card-identity">
              <span className="order-card-id">Order #{displayOrderNumber}</span>
              <span className="order-card-status">{displayStatus}</span>
              <span className="order-card-branch">· {branchName}</span>
            </div>
            <div className="order-card-date">
              <span><FiCalendar size={12} /> {formatOrderDate(order.timestamp || '')}</span>
              <span><FiClock size={12} /> {formatOrderTime(order.timestamp || '')}</span>
            </div>
          </div>
          <div className="order-card-summary">
            <span className="order-card-total">{formatCurrency(order.total)}</span>
            <span className="order-card-payment">{formatPaymentMethod(order.paymentMethod)}</span>
          </div>
        </div>

        {isScheduledOrder && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <span aria-hidden="true">🗓</span>
              <span>Scheduled delivery</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Scheduled for</p>
                <p className="font-semibold text-gray-800">{scheduleDetails.scheduledDate || 'Date not available'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Delivery time</p>
                <p className="font-semibold text-gray-800">{scheduleDetails.scheduledTime || 'Time not available'}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-orange-100 bg-white/60 px-3 py-2 text-xs text-orange-700">
              {scheduleDetails.scheduleDisplay || 'Scheduled Delivery'}
            </div>
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2 border-t border-orange-100 pt-2 text-xs text-orange-700">
              <span className="text-gray-500">Waiting for scheduled time</span>
            </div>
          </div>
        )}

        <div className="order-item-chips flex gap-1.5 pt-3 border-t border-gray-100 mt-3">
          {order.items.slice(0, 3).map((item, idx: number) => (
            <span key={idx} title={item.name} className="order-item-chip inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-lg text-xs text-gray-700 border border-gray-100">
              <span className="font-semibold text-[#2d6a4f]">{item.quantity}x</span>
              <span className="truncate max-w-[100px]">{item.name}</span>
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-gray-400 bg-gray-50 border border-gray-100">
              +{order.items.length - 3} more
            </span>
          )}
        </div>

        <div className="order-card-footer">
          <div className="order-card-actions">
            {isActive && (
              <button onClick={(e) => onTrack(order.id, e)} className="order-track-button">
                Track order <FiChevronRight size={15} />
              </button>
            )}
            {isDelivered && (
              <button type="button" onClick={() => onReorder(order)} disabled={orderingClosed} className="order-reorder-button disabled:cursor-not-allowed disabled:opacity-60">
                {orderingClosed ? 'Ordering is closed for today.' : 'Reorder'}
              </button>
            )}
            <button type="button" onClick={() => onToggleDetails(order.id)} className="order-details-button">
              {isExpanded ? 'Hide details' : 'View details'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="space-y-3">
              {order.items.map((item, itemIndex: number) => {
                const addonsTotal = (item.selectedAddons || []).reduce((sum: number, addon) => sum + Number(addon.price || 0), 0);
                const itemSubtotal = (Number(item.price || 0) * Number(item.quantity || 1)) + addonsTotal;

                return (
                  <div key={`${order.id}-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex justify-between gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1">
                            {item.selectedAddons.map((addon, addonIndex: number) => (
                              <div key={`${item.id}-${addonIndex}`} className="flex justify-between gap-3">
                                <span>+ {addon.name}</span>
                                <span>{formatCurrency(Number(addon.price || 0))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-gray-700">{formatCurrency(itemSubtotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {order.status === ORDER_STATUS.PENDING && (() => {
              const cancelSeconds = getOrderCancellationRemainingSeconds(order);
              const canCancelThisOrder = canCancelOrder(order);

              return (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500">
                    {canCancelThisOrder ? (
                      <span>
                        Cancel within {Math.ceil(cancelSeconds)}s
                      </span>
                    ) : (
                      <span>Cancellation period has ended.</span>
                    )}
                  </div>
                  {canCancelThisOrder ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onCancel(order)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:bg-red-100">
                        <FiTrash2 size={12} /> Cancel Order ({Math.ceil(cancelSeconds)}s)
                      </button>
                    </div>
                  ) : null}
                  {canCancelThisOrder && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-red-100 sm:max-w-40" aria-hidden="true">
                      <div className="h-full rounded-full bg-red-400 transition-[width] duration-300" style={{ width: `${Math.min(100, (cancelSeconds / ORDER_CANCELLATION_WINDOW_SECONDS) * 100)}%` }} />
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
              {(() => {
                const { productSubtotal, deliveryFee, serviceFee, priorityFee, vat } = (() => {
                  const subtotal = order.items.reduce((sum: number, item) => {
                    const addonTotal = (item.selectedAddons || []).reduce((addonSum: number, addon) => addonSum + Number(addon.price || 0), 0);
                    return sum + ((Number(item.price || 0) * Number(item.quantity || 1)) + addonTotal);
                  }, 0);

                  let localDeliveryFee = Number(order.deliveryFee ?? 0);
                  const localServiceFee = Number(order.serviceFee ?? 0);
                  let localPriorityFee = Number(order.priorityFee ?? 0);
                  let localVat = Number(order.vat ?? 0);

                  if (localPriorityFee === 0 && order.deliveryType === 'priority') {
                    localPriorityFee = 99;
                  }

                  if (localDeliveryFee === 0 && Number(order.total || 0) > 0) {
                    const derived = Number(order.total) - subtotal - localServiceFee - localPriorityFee - localVat;
                    localDeliveryFee = Math.max(0, Math.round(derived));
                  }

                  if (localVat === 0 && Number(order.total || 0) > 0) {
                    const beforeVat = subtotal + localDeliveryFee + localServiceFee + localPriorityFee;
                    localVat = Math.round((Number(order.total) - beforeVat) * 100) / 100;
                    if (localVat < 0) localVat = 0;
                  }

                  return {
                    productSubtotal: subtotal,
                    deliveryFee: localDeliveryFee,
                    serviceFee: localServiceFee,
                    priorityFee: localPriorityFee,
                    vat: localVat,
                  };
                })();

                return (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Product subtotal</span><span>{formatCurrency(productSubtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Delivery fee</span><span>{formatCurrency(deliveryFee)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Service fee</span><span>{formatCurrency(serviceFee)}</span></div>
                    {(order.deliveryType === 'priority' || priorityFee > 0) && (
                      <div className="flex justify-between"><span className="text-gray-500">Priority fee</span><span>{formatCurrency(priorityFee)}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-gray-500">VAT</span><span>{formatCurrency(vat)}</span></div>
                    <div className="flex justify-between font-semibold text-base text-[#2d6a4f] pt-2 border-t border-gray-100">
                      <span>Order total</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
