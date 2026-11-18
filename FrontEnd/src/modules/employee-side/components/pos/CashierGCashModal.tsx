import React, { useCallback, useEffect, useState } from 'react';
import { FaMobileAlt, FaSpinner, FaCopy, FaClock, FaCheckCircle } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { QRCodeCanvas } from 'qrcode.react';
import { formatPeso } from '../../../../utils/formatters';
import { API_URL } from '../../../../services/apiConfig';

interface CashierGCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  referenceNumber: string;
  returnUrl?: string;
  onPaymentConfirmed: (reference: string) => void;
  onRetry?: () => void;
  isLoading?: boolean;
}

export const CashierGCashModal: React.FC<CashierGCashModalProps> = ({
  isOpen,
  onClose,
  amount,
  referenceNumber,
  returnUrl,
  onPaymentConfirmed,
  onRetry,
  isLoading = false,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isCopied, setIsCopied] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Reset timer on open or new reference
  useEffect(() => {
    if (isOpen) {
      setTimeRemaining(300);
      setIsCopied(false);
      setIsConfirmed(false);
    }
  }, [isOpen, referenceNumber]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isConfirmed) return;
    const timer = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isConfirmed]);

  const handleCopyReference = useCallback(async () => {
    if (!referenceNumber) return;
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [referenceNumber]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/cashier/pos';
  const effectiveReturnUrl = returnUrl || currentPath;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = referenceNumber
    ? `${baseUrl}/payment/confirm/${encodeURIComponent(referenceNumber)}?amount=${amount}&returnUrl=${encodeURIComponent(effectiveReturnUrl)}`
    : '';

  // Poll payment status & listen to storage/postMessage
  useEffect(() => {
    if (!isOpen || !referenceNumber || isConfirmed) return;

    let isMounted = true;

    const handleSuccess = () => {
      if (!isMounted) return;
      setIsConfirmed(true);
      onPaymentConfirmed(referenceNumber);
      window.setTimeout(() => {
        if (isMounted) onClose();
      }, 1500);
    };

    const pollPaymentStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/payment/status/${encodeURIComponent(referenceNumber)}`);
        const data = await response.json().catch(() => ({}));
        if (data.status === 'paid' || data.confirmed === true) {
          handleSuccess();
        }
      } catch {
        // Silently continue polling
      }
    };

    const interval = window.setInterval(pollPaymentStatus, 2000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GCASH_PAYMENT_CONFIRMED' && event.data.reference === referenceNumber) {
        handleSuccess();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === `gcash_payment_confirmed_${referenceNumber}`) {
        handleSuccess();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen, referenceNumber, isConfirmed, onPaymentConfirmed, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Header matching customer-side GCash modal */}
        <div className="bg-gradient-to-r from-[#1a472a] to-[#2d6a4f] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FaMobileAlt className="text-white text-xl" />
              </div>
              <span className="text-white font-bold text-lg">GCash Payment</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close GCash payment modal"
              className="text-white/80 hover:text-white transition"
            >
              <IoClose size={24} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800">Generating GCash QR Code</h3>
              <p className="text-xs text-gray-500 mt-1">Connecting to payment service...</p>
            </div>
          ) : isConfirmed ? (
            <div className="py-10 flex flex-col items-center justify-center text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                <FaCheckCircle className="text-4xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Payment Confirmed!</h3>
              <p className="text-sm text-gray-600 mt-1">Transaction verified via GCash.</p>
              <span className="mt-3 font-mono text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full font-bold">
                {referenceNumber}
              </span>
            </div>
          ) : (
            <>
              {/* Amount to Pay Box */}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4 border border-gray-100">
                <p className="text-sm text-gray-500">Amount to Pay</p>
                <p className="text-3xl font-bold text-[#2d6a4f]">{formatPeso(amount)}</p>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-md">
                  {qrUrl ? (
                    <div role="img" aria-label="GCash payment QR code">
                      <QRCodeCanvas
                        value={qrUrl}
                        size={220}
                        level="H"
                        includeMargin
                        fgColor="#1a472a"
                      />
                    </div>
                  ) : (
                    <div className="w-[220px] h-[220px] flex items-center justify-center bg-gray-50 rounded-lg">
                      <FaSpinner className="animate-spin text-gray-400 text-2xl" />
                    </div>
                  )}
                </div>

                {/* Reference Number Row */}
                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                    <span className="text-sm text-gray-500">Reference:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#2d6a4f]">{referenceNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyReference}
                        title="Copy reference number"
                        className="text-gray-400 hover:text-[#2d6a4f] transition"
                      >
                        <FaCopy size={14} />
                      </button>
                    </div>
                  </div>
                  {isCopied && <p className="text-xs text-green-600 mt-1 text-center font-medium">Copied to clipboard!</p>}
                </div>

                {/* Countdown Timer */}
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <FaClock size={14} />
                  <span>
                    Time remaining:{' '}
                    <span className={`font-semibold ${timeRemaining < 60 ? 'text-red-500' : 'text-[#2d6a4f]'}`}>
                      {formatTime(timeRemaining)}
                    </span>
                  </span>
                </div>

                {/* Regenerate if expired */}
                {timeRemaining === 0 && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-4 text-sm text-[#e76f51] font-semibold hover:underline"
                  >
                    Generate new QR code
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

