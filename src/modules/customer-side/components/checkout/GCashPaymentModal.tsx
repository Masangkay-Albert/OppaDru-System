// src/modules/customer-side/components/checkout/GCashPaymentModal.tsx
import React, { useState } from 'react';
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

interface GCashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentComplete: (result: PaymentResult) => void;
}

const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete
}) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const { processGCash, isProcessing, result, formatCurrency } = usePayment();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const response = await processGCash(mobileNumber, amount);
    if (response?.success) {
      onPaymentComplete(response);
    }
  };

  const handleClose = () => {
    setMobileNumber('');
    onClose();
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
          <div className={`text-6xl ${result.success ? 'text-green-500' : 'text-red-500'}`}>
            {result.success ? '✅' : '❌'}
          </div>
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
            onClick={handleClose}
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
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <button onClick={handleClose} className="float-right text-gray-400 hover:text-gray-600 text-2xl">
          ×
        </button>

        <div className="text-center">
          <div className="text-6xl mb-3">📱</div>
          <h3 className="text-xl font-bold text-gray-800">GCash Payment</h3>
          <p className="text-sm text-gray-500 mt-1">Pay securely using your GCash account</p>
          <p className="text-2xl font-bold text-[#2d6a4f] mt-3">{formatCurrency(amount)}</p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value.replace(/\s/g, ''))}
            placeholder="09123456789"
            className="w-full px-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none"
            maxLength={11}
          />
          <p className="text-xs text-gray-400 mt-1">Enter your GCash registered mobile number</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!mobileNumber}
          className={`mt-4 w-full py-3 rounded-xl font-semibold transition ${
            mobileNumber
              ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Pay with GCash
        </button>
      </div>
    </div>
  );
};

export default GCashPaymentModal;