import React, { useRef, useState } from 'react';
import type { AdminOrder } from '../../../../services/adminOrderService';
import { formatPeso } from '../../../../utils/formatters';
import { FiPrinter, FiCheckCircle, FiX } from 'react-icons/fi';
import { getThirdPartyPlatformLabel } from '../../../../constants/thirdPartyPlatforms';

interface POSReceiptModalProps {
  order: AdminOrder | null;
  onClose: () => void;
  onNewOrder?: () => void;
}

const POSReceiptModal: React.FC<POSReceiptModalProps> = ({ order, onClose, onNewOrder }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [rollWidth, setRollWidth] = useState<'58mm' | '80mm'>('58mm');

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const diningOptionLabel = order.diningOption === 'dine_in'
    ? 'Dine-in'
    : order.diningOption === 'takeout'
    ? 'Takeout'
    : (order.delivery_type ? order.delivery_type.replace('_', ' ') : 'Onsite Walk-in');

  const customerName = order.customerName || order.customer_name || 'Walk-in Customer';
  const cashierIdentifier = order.cashierEmail || order.email || 'Counter Cashier';
  const platformLabel = getThirdPartyPlatformLabel(order.third_party_platform);

  const orderDate = order.created_at || order.timestamp ? new Date(order.created_at || order.timestamp!).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) : new Date().toLocaleString();

  // Subtotal & discount calculations
  const items = order.items || [];
  const rawSubtotal = items.reduce((sum, item) => {
    const itemPrice = Number(item.price || (item as any).product_price || 0);
    const itemQty = Number(item.quantity || 1);
    const addonsTotal = ((item.selectedAddons || (item as any).selected_addons || []) as any[]).reduce(
      (aSum, addon) => aSum + Number(addon.price || 0) * Number(addon.quantity || 1),
      0
    );
    return sum + (itemPrice * itemQty) + addonsTotal;
  }, 0);

  const specialDiscount = Number(order.discountAmount || 0);
  const promoDiscount = Number(order.promo_discount || (order as any).voucher_discount || 0);
  const totalAmount = Number(order.total || 0);
  const vatAmount = Number(order.vat || Math.round(totalAmount * 0.12 * 100) / 100);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar (Hidden during printing) */}
        <div className="bg-[var(--oppa-green)] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-xl text-emerald-300" />
            <span className="font-bold text-base">Receipt Preview</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl p-1 rounded-full hover:bg-white/10 transition"
          >
            <FiX />
          </button>
        </div>

        {/* Paper Size Selector (Hidden during printing) */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-600">Thermal Roll Width:</span>
          <div className="flex gap-1.5 bg-gray-200 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setRollWidth('58mm')}
              className={`px-3 py-1 rounded-md font-bold transition ${
                rollWidth === '58mm'
                  ? 'bg-white text-[var(--oppa-green)] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              58mm (Compact)
            </button>
            <button
              type="button"
              onClick={() => setRollWidth('80mm')}
              className={`px-3 py-1 rounded-md font-bold transition ${
                rollWidth === '80mm'
                  ? 'bg-white text-[var(--oppa-green)] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              80mm (Standard)
            </button>
          </div>
        </div>

        {/* Receipt Printable Area (Isolated by .thermal-receipt-printable in @media print) */}
        <div
          ref={receiptRef}
          className={`thermal-receipt-printable roll-${rollWidth} p-6 overflow-y-auto flex-1 font-mono text-xs text-gray-900 space-y-3 bg-white mx-auto`}
          style={{ width: rollWidth === '58mm' ? '100%' : '100%', maxWidth: rollWidth === '58mm' ? '320px' : '380px' }}
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <h3 className="font-extrabold text-sm tracking-wider text-black uppercase">
              OPPA DRU KOREAN FRIED CHICKEN
            </h3>
            <p className="text-[10px] text-gray-600">Zone 1, Dasmariñas City, Cavite</p>
            <p className="text-[10px] font-bold text-gray-800 tracking-wider">*** OFFICIAL ORDER RECEIPT ***</p>
          </div>

          {/* Metadata */}
          <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Order #:</span>
              <strong className="text-black">{order.order_number || order.orderNumber || order.id}</strong>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{orderDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span className="truncate max-w-[170px] text-right">{cashierIdentifier}</span>
            </div>
            <div className="flex justify-between">
              <span>Dining Type:</span>
              <span className="font-bold uppercase">{diningOptionLabel}</span>
            </div>
            {platformLabel && (
              <>
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-bold">{platformLabel}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Platform order #:</span>
                  <span className="break-all text-right font-bold">{order.external_order_ref}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{customerName}</span>
            </div>
            {order.phone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{order.phone}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-t border-dashed border-gray-400 pt-2 space-y-2 text-[11px]">
            <div className="flex justify-between font-bold pb-1 border-b border-gray-200">
              <span>ITEM (QTY x PRICE)</span>
              <span>AMOUNT</span>
            </div>

            {items.map((item, idx: number) => {
              const itemPrice = Number(item.price || (item as any).product_price || 0);
              const qty = Number(item.quantity || 1);
              const itemTotal = itemPrice * qty;
              const addons = (item.selectedAddons || (item as any).selected_addons || []) as any[];

              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="pr-2 leading-tight">
                      {qty}x {item.name || (item as any).product_name || 'Item'}
                      {item.selectedSize ? ` (${item.selectedSize})` : ''}
                      <span className="text-[10px] text-gray-500 block">@ {formatPeso(itemPrice)} each</span>
                    </span>
                    <span className="tabular-nums font-semibold shrink-0">{formatPeso(itemTotal)}</span>
                  </div>

                  {addons.length > 0 && (
                    <div className="pl-3 text-[10px] text-gray-600 space-y-0.5">
                      {addons.map((addon, aIdx: number) => (
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

          {/* Financial Totals & Discounts */}
          <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal:</span>
              <span className="tabular-nums">{formatPeso(rawSubtotal || totalAmount)}</span>
            </div>

            {specialDiscount > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Discount ({order.discountType || 'Special'}):</span>
                <span className="tabular-nums">−{formatPeso(specialDiscount)}</span>
              </div>
            )}

            {promoDiscount > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Promo ({order.promo_code || 'Voucher'}):</span>
                <span className="tabular-nums">−{formatPeso(promoDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-[10px] text-gray-500 pt-0.5">
              <span>VAT (12% inclusive):</span>
              <span className="tabular-nums">{formatPeso(vatAmount)}</span>
            </div>

            <div className="flex justify-between font-extrabold text-sm text-black pt-1.5 border-t border-gray-300">
              <span>TOTAL DUE:</span>
              <span className="tabular-nums">{formatPeso(totalAmount)}</span>
            </div>

            {/* Payment Details */}
            <div className="border-t border-dashed border-gray-300 pt-1.5 space-y-0.5">
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="font-bold">{platformLabel ? `Paid through ${platformLabel}` : (order.paymentMethod?.replace('_', ' ') || order.payment_method?.replace('_', ' ') || 'CASH')}</span>
              </div>

              {!platformLabel && (order.payment_reference || (order as any).paymentReference) && (
                <div className="flex justify-between text-[10px]">
                  <span>Ref #:</span>
                  <span className="font-mono">{order.payment_reference || (order as any).paymentReference}</span>
                </div>
              )}

              {order.cashTendered !== undefined && order.cashTendered > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered:</span>
                    <span className="tabular-nums">{formatPeso(order.cashTendered)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Change:</span>
                    <span className="tabular-nums">{formatPeso(order.changeDue || 0)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-dashed border-gray-400 pt-3 text-center text-[10px] text-gray-600 space-y-0.5">
            <p className="font-bold text-black">Thank you for dining at Oppa Dru!</p>
            <p>Please present this receipt at the counter.</p>
            <p className="text-[9px] pt-1">Oppa Dru Korean Fried Chicken POS System</p>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden during printing) */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 bg-white text-gray-800 font-bold text-sm hover:bg-gray-100 transition flex items-center justify-center gap-2 shadow-sm"
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
            {onNewOrder ? 'New Order' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSReceiptModal;
