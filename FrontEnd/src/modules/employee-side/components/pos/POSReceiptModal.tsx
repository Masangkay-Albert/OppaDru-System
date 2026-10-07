import React, { useRef } from 'react';
import type { AdminOrder } from '../../../../services/adminOrderService';
import { formatPeso } from '../../../../utils/formatters';
import { FiPrinter, FiCheckCircle, FiX } from 'react-icons/fi';

interface POSReceiptModalProps {
  order: AdminOrder | null;
  onClose: () => void;
  onNewOrder?: () => void;
}

const POSReceiptModal: React.FC<POSReceiptModalProps> = ({ order, onClose, onNewOrder }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const diningOptionLabel = order.diningOption === 'dine_in' ? 'Dine-in' : 'Takeout';
  const customerName = order.customerName || order.customer_name || 'Walk-in Customer';
  const orderDate = order.created_at || order.timestamp ? new Date(order.created_at || order.timestamp!).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) : new Date().toLocaleString();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-[var(--oppa-green)] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-xl text-emerald-300" />
            <span className="font-bold text-base">Order Processed Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl p-1 rounded-full hover:bg-white/10 transition"
          >
            <FiX />
          </button>
        </div>

        {/* Receipt Printable Area */}
        <div ref={receiptRef} className="p-6 overflow-y-auto flex-1 font-mono text-xs text-gray-800 space-y-3 bg-white">
          <div className="text-center space-y-1">
            <h3 className="font-serif font-extrabold text-base tracking-wide text-gray-900">
              OPPA DRU KOREAN FRIED CHICKEN
            </h3>
            <p className="text-[11px] text-gray-500">Zone 1, Dasmariñas City, Cavite</p>
            <p className="text-[11px] font-bold text-gray-600">*** ONSITE REGISTER RECEIPT ***</p>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Order #:</span>
              <strong className="text-gray-900">{order.order_number || order.id}</strong>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-bold uppercase text-[var(--oppa-green)]">{diningOptionLabel}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{customerName}</span>
            </div>
            {order.phone && (
              <div className="flex justify-between">
                <span>Contact:</span>
                <span>{order.phone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{orderDate}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2 space-y-2">
            <div className="flex justify-between font-bold text-[11px] text-gray-700 pb-1 border-b border-gray-100">
              <span>ITEM</span>
              <span>AMOUNT</span>
            </div>

            {order.items.map((item, idx: number) => {
              const itemTotal = Number(item.price || item.product_price || 0) * Number(item.quantity || 1);
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>
                      {item.quantity}x {item.name || item.product_name}
                      {item.selectedSize ? ` (${item.selectedSize})` : ''}
                    </span>
                    <span className="tabular-nums">{formatPeso(itemTotal)}</span>
                  </div>
                  {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="pl-3 text-[10px] text-gray-500 space-y-0.5">
                      {item.selectedAddons.map((addon, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between">
                          <span>+ {addon.name}</span>
                          <span className="tabular-nums">{formatPeso(Number(addon.price || 0))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-xs">
            <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-gray-200">
              <span>TOTAL DUE:</span>
              <span className="tabular-nums">{formatPeso(order.total || 0)}</span>
            </div>
            <div className="flex justify-between text-gray-600 text-[11px] pt-1">
              <span>Payment Method:</span>
              <span className="font-semibold uppercase">{order.paymentMethod?.replace('_', ' ') || 'CASH'}</span>
            </div>
            {order.cashTendered !== undefined && order.cashTendered > 0 && (
              <>
                <div className="flex justify-between text-gray-600 text-[11px]">
                  <span>Cash Tendered:</span>
                  <span className="tabular-nums">{formatPeso(order.cashTendered)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 text-xs">
                  <span>Change:</span>
                  <span className="tabular-nums">{formatPeso(order.changeDue || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 text-center text-[10px] text-gray-500 space-y-0.5">
            <p className="font-semibold">Thank you for dining at Oppa Dru!</p>
            <p>Please present this receipt at the counter.</p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition flex items-center justify-center gap-2 shadow-sm"
          >
            <FiPrinter size={16} />
            <span>Print Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewOrder?.();
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-[var(--oppa-green)] text-white font-bold text-sm hover:bg-[var(--oppa-green-dark)] transition shadow-md text-center"
          >
            New Order
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSReceiptModal;
