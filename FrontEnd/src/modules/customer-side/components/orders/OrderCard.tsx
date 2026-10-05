import React from 'react';
import {
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiHash,
  FiTrash2,
} from 'react-icons/fi';
import { FaCheck } from 'react-icons/fa';
import { ORDER_STATUS } from '../../../../utils/constants';
import {
  STATUS_DISPLAY,
  formatOrderDate,
  formatOrderTime,
  getScheduledOrderDetails,
  getStatusColor,
} from '../../../../utils/orderUtils';
import { canManageOrder, getOrderGraceRemainingSeconds } from '../../../../utils/orderManagement';
import { formatCurrency } from '../../../../utils/formatters';

interface OrderCardProps {
  order: any;
  isExpanded: boolean;
  onToggleDetails: (orderId: string) => void;
  onTrack: (orderId: string, event: React.MouseEvent) => void;
  onCancel: (order: any) => void;
  onEdit: (order: any) => void;
  graceStartedAtByOrder: Record<string, number>;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isExpanded,
  onToggleDetails,
  onTrack,
  onCancel,
  graceStartedAtByOrder,
}) => {
  const scheduleDetails = getScheduledOrderDetails(order);
  const effectiveStatus = scheduleDetails.isScheduled ? ORDER_STATUS.SCHEDULED : order.status;
  const isScheduledOrder = scheduleDetails.isScheduled && order.status !== ORDER_STATUS.DELIVERED;
  const displayStatus = isScheduledOrder
    ? STATUS_DISPLAY[ORDER_STATUS.SCHEDULED]
    : STATUS_DISPLAY[order.status] ?? STATUS_DISPLAY[ORDER_STATUS.PENDING];
  const isActive = order.status !== ORDER_STATUS.DELIVERED;
  const statusColor = getStatusColor(isScheduledOrder ? ORDER_STATUS.SCHEDULED : effectiveStatus);

  return (
    <div className="order-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${statusColor} border`}>
              {displayStatus.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="order-card-id font-semibold text-gray-800 text-sm">Order #{order.id.slice(-8).toUpperCase()}</span>
                <span className={`order-card-status text-xs font-medium px-2 py-0.5 rounded-full ${displayStatus.badgeClass} border flex items-center gap-1`}>
                  {displayStatus.icon}
                  {displayStatus.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <FiCalendar size={12} /> {formatOrderDate(order.timestamp || '')}
                </span>
                <span className="hidden xs:inline">•</span>
                <span className="flex items-center gap-1">
                  <FiClock size={12} /> {formatOrderTime(order.timestamp || '')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 ml-auto sm:ml-0">
            <div className="order-card-total text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-base font-bold text-[#2d6a4f]">{formatCurrency(order.total)}</p>
            </div>
            {isActive ? (
              <div className="order-card-chevron w-8 h-8 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f] flex-shrink-0">
                <FiChevronRight size={18} />
              </div>
            ) : (
              <div className="order-card-chevron w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 flex-shrink-0">
                <FaCheck size={15} />
              </div>
            )}
          </div>
        </div>

        {isScheduledOrder && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <span aria-hidden="true">🗓</span>
              <span>Scheduled Order</span>
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
              <span className="font-medium">Status: Scheduled</span>
              <span className="text-gray-500">Waiting for scheduled time</span>
            </div>
          </div>
        )}

        <div className="order-item-chips flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 mt-3">
          {order.items.slice(0, 3).map((item: any, idx: number) => (
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

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 mt-2.5">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <FiHash size={12} /> {order.id.slice(0, 12)}...
            </span>
            <span className="hidden xs:inline">•</span>
            <span className="capitalize">{order.paymentMethod?.replace('_', ' ') || 'Cash'}</span>
          </div>
          <div className="order-card-actions flex items-center gap-2">
            <button onClick={() => onToggleDetails(order.id)} className="order-details-button text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1">
              {isExpanded ? 'Hide Details' : 'View Details'}
            </button>
            {isActive ? (
              <button onClick={(e) => onTrack(order.id, e)} className="order-track-button text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1">
                Track Order <FiChevronRight size={14} />
              </button>
            ) : (
              <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <FaCheck size={12} /> Completed
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="space-y-3">
              {order.items.map((item: any, itemIndex: number) => {
                const addonsTotal = (item.selectedAddons || []).reduce((sum: number, addon: any) => sum + Number(addon.price || 0), 0);
                const itemSubtotal = (Number(item.price || 0) * Number(item.quantity || 1)) + addonsTotal;

                return (
                  <div key={`${order.id}-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex justify-between gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1">
                            {item.selectedAddons.map((addon: any, addonIndex: number) => (
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
              const canManageThisOrder = canManageOrder(order, graceStartedAtByOrder);

              return (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500">
                    {canManageThisOrder ? (
                      <span>
                        You can cancel or edit this order for {Math.ceil(getOrderGraceRemainingSeconds(order, graceStartedAtByOrder))}s
                      </span>
                    ) : (
                      <span>Your order has been finalized. Cancellation and editing are no longer available.</span>
                    )}
                  </div>
                  {canManageThisOrder ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => onCancel(order)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">
                        <FiTrash2 size={12} /> Cancel Order
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
              {(() => {
                const { productSubtotal, deliveryFee, serviceFee, priorityFee, vat } = (() => {
                  const subtotal = order.items.reduce((sum: number, item: any) => {
                    const addonTotal = (item.selectedAddons || []).reduce((addonSum: number, addon: any) => addonSum + Number(addon.price || 0), 0);
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
    </div>
  );
};
