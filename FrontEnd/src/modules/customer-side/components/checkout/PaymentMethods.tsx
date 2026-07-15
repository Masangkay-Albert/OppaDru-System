// src/modules/customer-side/components/checkout/PaymentMethods.tsx
import React from 'react';
import { FaMoneyBillWave, FaMobileAlt, FaCreditCard } from 'react-icons/fa';

interface PaymentMethodsProps {
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
}

const PAYMENT_OPTIONS = [
  { id: 'cash_on_delivery', name: 'Cash On Delivery', icon: FaMoneyBillWave },
  { id: 'gcash', name: 'GCash', icon: FaMobileAlt },
  { id: 'credit_card', name: 'Credit or Debit Card', icon: FaCreditCard }
];

const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  paymentMethod,
  setPaymentMethod
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Payment</h2>
      </div>

      <div className="space-y-2">
        {PAYMENT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <label
              key={option.id}
              className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                paymentMethod === option.id
                  ? 'border-[#2d6a4f] bg-[#d8f3dc]/30'
                  : 'border-gray-200 hover:border-[#e76f51]'
              }`}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === option.id}
                onChange={() => setPaymentMethod(option.id)}
                className="accent-[#2d6a4f] w-4 h-4"
              />
              <Icon className="text-xl text-[#2d6a4f]" />
              <span className="text-sm text-gray-700">{option.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentMethods;