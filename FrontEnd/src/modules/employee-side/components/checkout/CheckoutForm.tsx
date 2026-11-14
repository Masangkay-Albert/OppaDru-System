import React from 'react';
import DiningOptionSelector from '../pos/DiningOptionSelector';
import POSCashCalculator from '../pos/POSCashCalculator';
import { Check, Smartphone, QrCode, Tag, Loader2 } from 'lucide-react';
import { formatPeso } from '../../../../utils/formatters';
import { getThirdPartyPlatformLabel, THIRD_PARTY_PLATFORMS, type OrderSource } from '../../../../constants/thirdPartyPlatforms';

interface CheckoutFormProps {
  orderSource: OrderSource;
  setOrderSource: (source: OrderSource) => void;
  externalOrderRef: string;
  setExternalOrderRef: (reference: string) => void;
  orderReferenceError?: string;
  setOrderReferenceError?: (error: string) => void;
  diningOption: 'dine_in' | 'takeout';
  setDiningOption: (val: 'dine_in' | 'takeout') => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  paymentReference: string;
  setPaymentReference: (val: string) => void;
  cashTendered: number;
  setCashTendered: (val: number) => void;
  totalDue: number;
  discountType: 'PWD' | 'Senior Citizen' | null;
  setDiscountType: (val: 'PWD' | 'Senior Citizen' | null) => void;
  discountIdNumber: string;
  setDiscountIdNumber: (val: string) => void;
  onOpenGCashModal?: () => void;
  promoCode?: string;
  setPromoCode?: (val: string) => void;
  promoDiscount?: number;
  promoTitle?: string;
  onApplyPromo?: () => void;
  onRemovePromo?: () => void;
  isPromoValidating?: boolean;
  promoError?: string;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  orderSource,
  setOrderSource,
  externalOrderRef,
  setExternalOrderRef,
  setOrderReferenceError,
  diningOption,
  setDiningOption,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  notes,
  setNotes,
  paymentMethod,
  setPaymentMethod,
  paymentReference,
  cashTendered,
  setCashTendered,
  totalDue,
  discountType,
  setDiscountType,
  discountIdNumber,
  setDiscountIdNumber,
  onOpenGCashModal,
  promoCode = '',
  setPromoCode,
  promoDiscount = 0,
  promoTitle = '',
  onApplyPromo,
  onRemovePromo,
  isPromoValidating = false,
  promoError = '',
}) => {
  const isThirdParty = orderSource !== 'walk_in';
  const platformLabel = getThirdPartyPlatformLabel(orderSource);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
        <h3 className="mb-3 font-bold text-gray-800">Order source</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" aria-pressed={orderSource === 'walk_in'} onClick={() => setOrderSource('walk_in')} className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold transition ${orderSource === 'walk_in' ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            Walk-in
          </button>
          {THIRD_PARTY_PLATFORMS.map((platform) => (
            <button key={platform.key} type="button" aria-pressed={orderSource === platform.key} onClick={() => setOrderSource(platform.key)} className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold transition ${orderSource === platform.key ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {platform.label}
            </button>
          ))}
        </div>
        {isThirdParty && platformLabel && (
          <div className="mt-4">
            <label htmlFor="third-party-order-reference" className="mb-1.5 block text-sm font-semibold text-gray-700">
              {platformLabel} order number <span className="text-red-600">*</span>
            </label>
            <input
              id="third-party-order-reference"
              type="text"
              required={isThirdParty}
              autoComplete="off"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9-]{3,30}"
              title="Use 3-30 letters, numbers, or hyphens"
              value={externalOrderRef}
              onChange={(event) => {
                setExternalOrderRef(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30));
                setOrderReferenceError?.('');
              }}
              placeholder="Enter the platform order number"
              className="min-h-11 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm uppercase tracking-wide focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
            />
          </div>
        )}
      </section>

      {/* Dining Option (Dine-in vs Takeout) */}
      {isThirdParty ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 text-sm font-semibold text-gray-800">
          Dining option: Takeout
        </div>
      ) : (
        <DiningOptionSelector value={diningOption} onChange={setDiningOption} />
      )}

      {/* Customer & Register Reference */}
      {!isThirdParty && <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-base">Customer Details (Optional)</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Customer Name / Callout
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in Customer"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              Contact / Phone #
            </label>
            <input
              type="tel"
              value={customerPhone}
              pattern="(\\+?63|0)?9\\d{9}"
              title="Philippine mobile number (e.g. 09123456789)"
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="09XX XXX XXXX (optional)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
            Order Notes / Kitchen Instructions
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g., extra crispy, sauce on the side, no onions"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent"
          />
        </div>
      </div>}

      {/* Onsite Discounts & Promos */}
      {!isThirdParty && <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-base">Discounts & Promos</h3>
        
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setDiscountType(null)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              discountType === null
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Regular (No Discount)
          </button>
          <button
            type="button"
            onClick={() => setDiscountType('Senior Citizen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              discountType === 'Senior Citizen'
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Senior Citizen (20%)
          </button>
          <button
            type="button"
            onClick={() => setDiscountType('PWD')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              discountType === 'PWD'
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            PWD (20%)
          </button>
        </div>

        {discountType && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              {discountType} ID Card Number
            </label>
            <input
              type="text"
              value={discountIdNumber}
              onChange={(e) => setDiscountIdNumber(e.target.value)}
              placeholder={`Enter ${discountType} ID #`}
              className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent"
            />
          </div>
        )}

        {/* Promo Code Input for Cashier */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
            <Tag size={14} className="text-[var(--oppa-green)]" />
            <span>Apply Store Promo / Voucher</span>
          </div>

          {promoDiscount > 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-800">{promoTitle || 'Active Promo Applied'}</p>
                <p className="text-[11px] text-emerald-600">
                  Code: <span className="font-mono font-bold uppercase">{promoCode}</span> · Discount: −{formatPeso(promoDiscount)}
                </p>
              </div>
              {onRemovePromo && (
                <button
                  type="button"
                  onClick={onRemovePromo}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode?.(e.target.value.toUpperCase())}
                placeholder="Enter promo code (e.g. OPPA10, DEAL99)"
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
              />
              <button
                type="button"
                disabled={isPromoValidating || !promoCode.trim()}
                onClick={onApplyPromo}
                className="px-4 py-2 bg-[var(--oppa-green)] text-white rounded-xl text-xs font-bold hover:bg-[var(--oppa-green-dark)] transition disabled:opacity-50 flex items-center gap-1"
              >
                {isPromoValidating && <Loader2 size={12} className="animate-spin" />}
                <span>Apply Promo</span>
              </button>
            </div>
          )}
          {promoError && <p className="text-red-500 text-xs mt-1.5">{promoError}</p>}
        </div>
      </div>}

      {/* POS Payment Methods */}
      {!isThirdParty ? <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-base">Payment Processing</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={paymentMethod === 'cash'}
            onClick={() => setPaymentMethod('cash')}
            className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
              paymentMethod === 'cash'
                ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] font-bold shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span aria-hidden="true" className="mb-1 flex size-7 items-center justify-center rounded-full border-2 border-current text-lg font-bold leading-none">₱</span>
            {paymentMethod === 'cash' && <Check size={14} className="absolute right-2 top-2" aria-hidden="true" />}
            <span className="text-xs font-semibold">Cash</span>
          </button>

          <button
            type="button"
            aria-pressed={paymentMethod === 'gcash'}
            onClick={() => setPaymentMethod('gcash')}
            className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
              paymentMethod === 'gcash'
                ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] font-bold shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Smartphone size={22} className="mb-1 text-blue-500" />
            {paymentMethod === 'gcash' && <Check size={14} className="absolute right-2 top-2" aria-hidden="true" />}
            <span className="text-xs font-semibold">GCash (QR Scan)</span>
          </button>

        </div>

        {paymentMethod === 'cash' && (
          <POSCashCalculator
            totalDue={totalDue}
            cashTendered={cashTendered}
            onCashTenderedChange={setCashTendered}
          />
        )}

        {paymentMethod === 'gcash' && (
          <div className="pt-2 p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                  <QrCode size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">GCash Dynamic QR Payment</h4>
                  <p className="text-xs text-blue-700">Identical customer-facing QR code and real-time verification.</p>
                </div>
              </div>
              {onOpenGCashModal && (
                <button
                  type="button"
                  onClick={onOpenGCashModal}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <QrCode size={14} />
                  <span>{paymentReference ? 'View QR' : 'Show QR Code'}</span>
                </button>
              )}
            </div>

            {paymentReference ? (
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-gray-600">Reference:</span>
                  <span className="font-mono font-bold text-emerald-800">{paymentReference}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                  Payment Verified
                </span>
              </div>
            ) : (
              <p className="text-xs text-blue-800 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                A dynamic QR code for <strong className="text-blue-950">{formatPeso(totalDue)}</strong> will display when you charge the order, or click &quot;Show QR Code&quot; above to let the customer scan now.
              </p>
            )}
          </div>
        )}
      </div> : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <h3 className="font-bold">Payment</h3>
          <p className="mt-1">Paid through {platformLabel}.</p>
        </div>
      )}
    </div>
  );
};

export default CheckoutForm;
