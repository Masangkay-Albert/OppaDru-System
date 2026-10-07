import React from 'react';
import DiningOptionSelector from '../pos/DiningOptionSelector';
import POSCashCalculator from '../pos/POSCashCalculator';
import { Check, CreditCard, Smartphone } from 'lucide-react';

interface CheckoutFormProps {
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
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
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
  setPaymentReference,
  cashTendered,
  setCashTendered,
  totalDue,
  discountType,
  setDiscountType,
  discountIdNumber,
  setDiscountIdNumber,
}) => {
  return (
    <div className="space-y-6">
      {/* Dining Option (Dine-in vs Takeout) */}
      <DiningOptionSelector value={diningOption} onChange={setDiningOption} />

      {/* Customer & Register Reference */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
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
      </div>

      {/* Onsite Discounts (Senior / PWD) */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-base">Discounts</h3>
        
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
      </div>

      {/* POS Payment Methods */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-800 text-base">Payment Processing</h3>

        <div className="grid grid-cols-3 gap-3">
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
            <span className="text-xs font-semibold">GCash</span>
          </button>

          <button
            type="button"
            aria-pressed={paymentMethod === 'credit_card'}
            onClick={() => setPaymentMethod('credit_card')}
            className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border transition ${
              paymentMethod === 'credit_card'
                ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] font-bold shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <CreditCard size={22} className="mb-1 text-purple-500" />
            {paymentMethod === 'credit_card' && <Check size={14} className="absolute right-2 top-2" aria-hidden="true" />}
            <span className="text-xs font-semibold">Card / Terminal</span>
          </button>
        </div>

        {paymentMethod === 'cash' && (
          <POSCashCalculator
            totalDue={totalDue}
            cashTendered={cashTendered}
            onCashTenderedChange={setCashTendered}
          />
        )}

        {(paymentMethod === 'gcash' || paymentMethod === 'credit_card') && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              {paymentMethod === 'gcash' ? 'GCash Reference Number' : 'POS Terminal / Card Reference'}
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Enter reference / transaction #"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutForm;
