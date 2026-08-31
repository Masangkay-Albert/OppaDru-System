import React from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import type { PaymentResult } from './paymentTypes';

interface PaymentStatusDialogProps {
  result: PaymentResult;
  onPrimaryAction: () => void;
  successLabel?: string;
  failureLabel?: string;
}

export const PaymentStatusDialog: React.FC<PaymentStatusDialogProps> = ({
  result,
  onPrimaryAction,
  successLabel = 'Continue',
  failureLabel = 'Try Again',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-scaleIn">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          {result.success ? (
            <FaCheckCircle className="text-5xl text-green-500" />
          ) : (
            <FaTimesCircle className="text-5xl text-red-500" />
          )}
        </div>
        <h3 className={`text-xl font-bold mt-4 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.success ? 'Payment Successful!' : 'Payment Failed'}
        </h3>
        <p className="text-gray-600 mt-2">{result.message}</p>
        {result.referenceNumber && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Reference Number</p>
            <p className="font-mono font-bold text-[#2d6a4f] mt-1 text-lg">{result.referenceNumber}</p>
          </div>
        )}
        <button
          onClick={onPrimaryAction}
          className={`mt-6 w-full py-3 rounded-xl font-semibold transition ${
            result.success
              ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
              : 'bg-[#e76f51] text-white hover:bg-[#d45b3d]'
          }`}
        >
          {result.success ? successLabel : failureLabel}
        </button>
      </div>
    </div>
  );
};
