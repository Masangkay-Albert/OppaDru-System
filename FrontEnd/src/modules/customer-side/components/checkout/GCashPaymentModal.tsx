import React from 'react';
import { FaMobileAlt, FaSpinner, FaCopy, FaClock } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { QRCodeCanvas } from 'qrcode.react';
import { formatCurrency } from '../../../../utils/formatters';
import type { CartItem } from '../../../../types/product.types';
import type { PaymentResult } from './paymentTypes';
import { PaymentStatusDialog } from './PaymentStatusDialog';
import { useGCashPaymentFlow } from '../../../../hooks/useGCashPaymentFlow';

interface GCashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  items: CartItem[];
  deliveryType?: 'standard' | 'priority' | 'scheduled' | 'onsite';
  promoCode?: string | null;
  cashierMode?: boolean;
  discountType?: 'PWD' | 'Senior Citizen' | null;
  discountIdNumber?: string;
  discountRate?: number;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  franchiseId?: string | null;
  onPaymentComplete: (result: PaymentResult) => void;
  onPaymentConfirmed?: () => void;
  onPaymentCreated?: (reference: string) => void;
}

const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  items,
  deliveryType = 'onsite',
  promoCode,
  cashierMode = false,
  discountType,
  discountIdNumber,
  discountRate = 0,
  deliveryCoordinates,
  franchiseId,
  onPaymentComplete,
  onPaymentCreated,
}) => {
  const {
    step,
    paymentAmount,
    referenceNumber,
    timeRemaining,
    isCopied,
    result,
    handleClose,
    handleRetry,
    handleCopyReference,
    formatTime,
    generateQRData,
  } = useGCashPaymentFlow({
    isOpen,
    amount,
    items,
    deliveryType,
    promoCode,
    cashierMode,
    discountType,
    discountIdNumber,
    discountRate,
    deliveryCoordinates,
    franchiseId,
    onPaymentComplete,
    onPaymentCreated,
  });

  if (!isOpen) return null;

  if (step === 'confirming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="flex justify-center">
            <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mt-4">Verifying Payment</h3>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment...</p>
          <div className="mt-4 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#2d6a4f] rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && result) {
    return (
      <PaymentStatusDialog
        result={result}
        onPrimaryAction={() => {
          if (result.success) {
            handleClose();
            onClose();
          } else {
            handleRetry();
          }
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a472a] to-[#2d6a4f] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FaMobileAlt className="text-white text-xl" />
              </div>
              <span className="text-white font-bold text-lg">GCash Payment</span>
            </div>
            <button onClick={() => { handleClose(); onClose(); }} className="text-white/80 hover:text-white transition">
              <IoClose size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center mb-4 border border-gray-100">
            <p className="text-sm text-gray-500">Amount to Pay</p>
            <p className="text-3xl font-bold text-[#2d6a4f]">{formatCurrency(paymentAmount)}</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-md">
              <a href={generateQRData()} target="_blank" rel="noopener noreferrer" title="Scan or click to open simulated GCash confirmation" className="block transition-transform hover:scale-105 cursor-pointer">
                <QRCodeCanvas value={generateQRData()} size={220} level="H" includeMargin fgColor="#1a472a" />
              </a>
            </div>

            <div className="mt-4 w-full">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <span className="text-sm text-gray-500">Reference:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#2d6a4f]">{referenceNumber}</span>
                  <button onClick={handleCopyReference} className="text-gray-400 hover:text-[#2d6a4f] transition">
                    <FaCopy size={14} />
                  </button>
                </div>
              </div>
              {isCopied && <p className="text-xs text-green-600 mt-1 text-center">Copied to clipboard!</p>}
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <FaClock size={14} />
              <span>
                Time remaining:{' '}
                <span className={`font-semibold ${timeRemaining < 60 ? 'text-red-500' : 'text-[#2d6a4f]'}`}>
                  {formatTime(timeRemaining)}
                </span>
              </span>
            </div>

            
            {referenceNumber && (
              <a
                href={`/payment/confirm/${referenceNumber}?amount=${paymentAmount}&returnUrl=${encodeURIComponent(window.location.pathname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-bold transition border border-blue-200 shadow-2xs"
              >
                <span>Simulate GCash Redirect & Confirm</span>
                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded-md">Demo</span>
              </a>
            )}
            
            {timeRemaining === 0 && (
              <button onClick={handleRetry} className="mt-4 text-sm text-[#e76f51] font-medium hover:underline">
                Generate new QR code
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCashPaymentModal;
