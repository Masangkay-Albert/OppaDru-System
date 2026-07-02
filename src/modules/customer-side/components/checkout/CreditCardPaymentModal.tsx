// src/modules/customer-side/components/checkout/CreditCardPaymentModal.tsx
import React, { useState } from 'react';
import { FaCreditCard, FaCheckCircle, FaTimesCircle, FaLock, FaCcVisa, FaCcMastercard, FaCcAmex, FaCcDiscover } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { usePayment } from '../../../../hooks/usePayment';

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  referenceNumber?: string;
  message: string;
  timestamp: string;
  paymentMethod: 'gcash' | 'credit_card' | 'cash_on_delivery';
  amount: number;
}

interface CreditCardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentComplete: (result: PaymentResult) => void;
}

const CreditCardPaymentModal: React.FC<CreditCardPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete
}) => {
  const [form, setForm] = useState({
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });

  const { processCard, isProcessing, result, formatCurrency, reset } = usePayment();

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    let formatted = value;

    if (field === 'cardNumber') {
      formatted = value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    }
    if (field === 'expiryMonth') {
      formatted = value.replace(/\D/g, '').slice(0, 2);
    }
    if (field === 'expiryYear') {
      formatted = value.replace(/\D/g, '').slice(0, 4);
    }
    if (field === 'cvv') {
      formatted = value.replace(/\D/g, '').slice(0, 4);
    }

    setForm(prev => ({ ...prev, [field]: formatted }));
  };

  const isFormValid = () => {
    return (
      form.cardNumber.replace(/\s/g, '').length === 16 &&
      form.cardHolderName.trim().length >= 2 &&
      form.expiryMonth.length === 2 &&
      form.expiryYear.length === 4 &&
      form.cvv.length >= 3
    );
  };

  const handleSubmit = async () => {
    const response = await processCard({
      cardNumber: form.cardNumber.replace(/\s/g, ''),
      cardHolderName: form.cardHolderName,
      expiryMonth: form.expiryMonth,
      expiryYear: form.expiryYear,
      cvv: form.cvv,
      amount
    });
    if (response?.success) {
      onPaymentComplete(response);
    }
  };

  const handleClose = () => {
    setForm({ cardNumber: '', cardHolderName: '', expiryMonth: '', expiryYear: '', cvv: '' });
    reset();
    onClose();
  };

  const CardTypeIcon = () => {
    const clean = form.cardNumber.replace(/\s/g, '');
    if (clean.startsWith('4')) return <FaCcVisa size={32} className="opacity-80" />;
    if (clean.startsWith('5')) return <FaCcMastercard size={32} className="opacity-80" />;
    if (clean.startsWith('3')) return <FaCcAmex size={32} className="opacity-80" />;
    if (clean.startsWith('6')) return <FaCcDiscover size={32} className="opacity-80" />;
    return null;
  };

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#2d6a4f] mx-auto" />
          <h3 className="text-xl font-semibold text-gray-800 mt-4">Processing Payment</h3>
          <p className="text-sm text-gray-500 mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
          {result.success ? (
            <FaCheckCircle className="text-6xl text-green-500 mx-auto" />
          ) : (
            <FaTimesCircle className="text-6xl text-red-500 mx-auto" />
          )}
          <h3 className={`text-xl font-bold mt-3 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Payment Successful!' : 'Payment Failed'}
          </h3>
          <p className="text-gray-600 mt-2">{result.message}</p>
          {result.referenceNumber && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 font-medium">Reference Number</p>
              <p className="font-mono font-bold text-[#2d6a4f] mt-1">{result.referenceNumber}</p>
            </div>
          )}
          <button
            onClick={() => {
              if (result.success) {
                handleClose();
              } else {
                reset();
              }
            }}
            className="mt-4 w-full py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4332]"
          >
            {result.success ? 'Continue' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button onClick={handleClose} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
          <IoClose size={24} />
        </button>

        <div className="text-center pt-2">
          <FaCreditCard className="text-5xl text-[#2d6a4f] mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-800">Credit / Debit Card</h3>
          <p className="text-sm text-gray-500 mt-1">Enter your card details securely</p>
          <p className="text-2xl font-bold text-[#2d6a4f] mt-3">{formatCurrency(amount)}</p>
        </div>

        <div className="mt-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 text-white min-h-[120px]">
          <div className="flex justify-end h-8">
            <CardTypeIcon />
          </div>
          <div className="font-mono text-lg tracking-wider">
            {form.cardNumber || '•••• •••• •••• ••••'}
          </div>
          <div className="flex justify-between text-xs mt-3">
            <div>
              <div className="opacity-50">Card Holder</div>
              <div className="font-semibold uppercase text-sm">
                {form.cardHolderName || 'FULL NAME'}
              </div>
            </div>
            <div className="text-right">
              <div className="opacity-50">Expires</div>
              <div>{form.expiryMonth || 'MM'}/{form.expiryYear || 'YYYY'}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
            <input
              type="text"
              value={form.cardNumber}
              onChange={(e) => handleChange('cardNumber', e.target.value)}
              placeholder="1234 5678 9012 3456"
              className="w-full px-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none"
              maxLength={19}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Card Holder Name</label>
            <input
              type="text"
              value={form.cardHolderName}
              onChange={(e) => handleChange('cardHolderName', e.target.value.toUpperCase())}
              placeholder="JOHN DOE"
              className="w-full px-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none uppercase"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.expiryMonth}
                  onChange={(e) => handleChange('expiryMonth', e.target.value)}
                  placeholder="MM"
                  className="w-1/2 px-4 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none"
                  maxLength={2}
                />
                <input
                  type="text"
                  value={form.expiryYear}
                  onChange={(e) => handleChange('expiryYear', e.target.value)}
                  placeholder="YYYY"
                  className="w-1/2 px-4 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none"
                  maxLength={4}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
              <input
                type="password"
                value={form.cvv}
                onChange={(e) => handleChange('cvv', e.target.value)}
                placeholder="•••"
                className="w-full px-4 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none"
                maxLength={4}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-xl">
          <FaLock className="text-green-500" size={14} />
          <span>Your payment information is secure and encrypted</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isFormValid()}
          className={`mt-3 w-full py-3 rounded-xl font-semibold transition ${
            isFormValid()
              ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Pay {formatCurrency(amount)}
        </button>
      </div>
    </div>
  );
};

export default CreditCardPaymentModal;