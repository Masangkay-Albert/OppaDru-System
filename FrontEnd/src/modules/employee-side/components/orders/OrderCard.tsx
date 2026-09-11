import React from 'react';
import {
  FiCalendar,
  FiClock,
  FiHash,
  FiTrash2,
  FiPrinter,
} from 'react-icons/fi';
import { FaCheck, FaUtensils, FaShoppingBag } from 'react-icons/fa';
import { formatCurrency } from '../../../../utils/formatters';
import type { AdminOrder } from '../../../../services/adminOrderService';

interface OrderCardProps {
  order: AdminOrder;
  isExpanded: boolean;
  onToggleDetails: (orderId: string) => void;
  onMarkServed: (orderId: string) => void;
  onCancel: (order: AdminOrder) => void;
  onViewReceipt: (order: AdminOrder) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isExpanded,
  onToggleDetails,
  onMarkServed,
  onCancel,
  onViewReceipt,
}) => {
  const isDelivered = order.status === 'delivered' || order.served;
  const isDineIn = order.diningOption === 'dine_in';
  const customerName = order.customerName || order.customer_name || 'Walk-in Customer';

  const orderDate = order.created_at || order.timestamp;
  const formattedDate = orderDate ? new Date(orderDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Today';

  const formattedTime = orderDate ? new Date(orderDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : '';

  const getStatusBadge = () => {
    if (isDelivered) {
      return (
        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
          <FaCheck size={10} /> Served
        </span>
      );
    }
    if (order.status === 'ready') {
      return (
        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-200">
          Ready for Pickup
        </span>
      );
    }
    return (
      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
        Preparing
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden transition-all duration-300">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl flex-shrink-0 ${isDineIn ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {isDineIn ? <FaUtensils size={16} /> : <FaShoppingBag size={16} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-sm">
                  {order.order_number || order.id}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  {isDineIn ? 'Dine-in' : 'Takeout'}
                </span>
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                <span className="font-medium text-gray-600">{customerName}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FiCalendar size={12} /> {formattedDate}
                </span>
                {formattedTime && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FiClock size={12} /> {formattedTime}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 ml-auto sm:ml-0">
            <div className="text-right">
              <p className="text-[11px] uppercase font-semibold tracking-wider text-gray-400">Total</p>
              <p className="text-base font-extrabold text-[var(--oppa-green)]">
                {formatCurrency(order.total || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Order Items preview chips */}
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 mt-3">
          {order.items.slice(0, 4).map((item: any, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-lg text-xs text-gray-700 border border-gray-100"
            >
              <span className="font-semibold text-[var(--oppa-green)]">{item.quantity}x</span>
              <span className="truncate max-w-[120px]">{item.name || item.product_name}</span>
            </span>
          ))}
          {order.items.length > 4 && (
            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs text-gray-400 bg-gray-50 border border-gray-100">
              +{order.items.length - 4} more
            </span>
          )}
        </div>

        {/* Card Footer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-3 text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="flex items-center gap-1">
              <FiHash size={12} /> {order.paymentMethod?.replace('_', ' ') || 'Cash'}
            </span>
            {order.channel && (
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">
                ONSITE REGISTER
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleDetails(order.id)}
              className="font-semibold text-[var(--oppa-green)] hover:underline"
            >
              {isExpanded ? 'Hide Details' : 'View Details'}
            </button>

            <button
              onClick={() => onViewReceipt(order)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1 font-medium transition"
              title="View & Print Receipt"
            >
              <FiPrinter size={13} />
              <span>Receipt</span>
            </button>

            {!isDelivered && (
              <button
                onClick={() => onMarkServed(order.id)}
                className="px-3 py-1.5 rounded-lg bg-[var(--oppa-green)] text-white font-bold hover:bg-[var(--oppa-green-dark)] flex items-center gap-1 shadow-sm transition"
              >
                <FaCheck size={11} />
                <span>Mark Served</span>
              </button>
            )}

            {!isDelivered && (
              <button
                onClick={() => onCancel(order)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                title="Cancel Order"
              >
                <FiTrash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <div className="space-y-2">
              {order.items.map((item: any, itemIndex: number) => {
                const itemSubtotal = Number(item.price || item.product_price || 0) * Number(item.quantity || 1);
                return (
                  <div key={itemIndex} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm">
                    <div className="flex justify-between font-medium text-gray-800">
                      <span>
                        {item.quantity}x {item.name || item.product_name}
                        {item.selectedSize ? ` (${item.selectedSize})` : ''}
                      </span>
                      <span>{formatCurrency(itemSubtotal)}</span>
                    </div>

                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <div className="mt-1 pl-3 text-xs text-gray-500 space-y-0.5">
                        {item.selectedAddons.map((addon: any, aIdx: number) => (
                          <div key={aIdx} className="flex justify-between">
                            <span>+ {addon.name}</span>
                            <span>{formatCurrency(Number(addon.price || 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.specialInstructions && (
                      <p className="mt-1 text-xs text-gray-500 italic">
                        Note: {item.specialInstructions}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {order.notes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Kitchen Note:</strong> {order.notes}
              </div>
            )}

            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[var(--oppa-green)] pt-1 border-t border-gray-100">
                <span>Total Amount</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

