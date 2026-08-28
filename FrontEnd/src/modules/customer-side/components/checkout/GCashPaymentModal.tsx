import React, { useState, useEffect, useRef } from 'react';
import {
  FaMobileAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaCopy,
  FaClock,
} from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { QRCodeCanvas } from 'qrcode.react';
import { formatCurrency } from '../../../../utils/formatters';

// Use production API URL - no localhost fallback
const API_URL = 'https://oppadru-system.onrender.com/api';
const APP_URL = import.meta.env.VITE_APP_URL || 'https://oppa-dru-system.vercel.app';

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
  onPaymentConfirmed?: () => void;
  onPaymentCreated?: (reference: string) => void;
}

type Step = 'display' | 'confirming' | 'result';

const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete,
  onPaymentConfirmed,
  onPaymentCreated,
}) => {
  const [step, setStep] = useState<Step>('display');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [isCopied, setIsCopied] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionHandledRef = useRef(false);
  const paymentCreationRef = useRef<Promise<void> | null>(null);

  const handleClose = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    setStep('display');
    setResult(null);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      completionHandledRef.current = false;
      setReferenceNumber('');
      setStep('display');
      setTimeRemaining(300);
      setIsCopied(false);
      setResult(null);
      if (paymentCreationRef.current) return;
      paymentCreationRef.current = fetch(`${API_URL}/payment/gcash/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      }).then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.reference) {
          setResult({ success: false, message: data.message || 'Unable to start GCash payment.', timestamp: new Date().toISOString(), paymentMethod: 'gcash', amount });
          setStep('result');
          return;
        }
        setReferenceNumber(data.reference);
        onPaymentCreated?.(data.reference);
      }).catch(() => {
        setResult({ success: false, message: 'Unable to connect to the payment server.', timestamp: new Date().toISOString(), paymentMethod: 'gcash', amount });
        setStep('result');
      }).finally(() => {
        paymentCreationRef.current = null;
      });
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [isOpen, amount, onPaymentCreated]);

  useEffect(() => {
    if (!isOpen || !referenceNumber) return;

    const handlePaymentConfirmed = () => {
      if (completionHandledRef.current) return;
      completionHandledRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
      const successResult: PaymentResult = {
        success: true,
        referenceNumber,
        message: 'Payment confirmed!',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount,
      };
      setResult(successResult);
      setStep('result');
      onPaymentComplete(successResult);
      autoCloseRef.current = setTimeout(handleClose, 1500);
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GCASH_PAYMENT_CONFIRMED' && event.data.reference === referenceNumber) {
        handlePaymentConfirmed();
      }
    };
    const closeAfterStorageUpdate = (event: StorageEvent) => {
      if (event.key === `gcash_payment_confirmed_${referenceNumber}`) {
        handlePaymentConfirmed();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', closeAfterStorageUpdate);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', closeAfterStorageUpdate);
    };
  }, [isOpen, referenceNumber, amount, onPaymentComplete]);

  useEffect(() => {
    if (!isOpen || step !== 'display') return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || step !== 'display' || !referenceNumber) return;

    const checkPaymentStatus = async () => {
      try {
        console.log('Checking payment status for:', referenceNumber);
        const response = await fetch(`${API_URL}/payment/status/${referenceNumber}`);
        const data = await response.json();
        console.log('Payment status response:', data);

        if (data.status === 'paid') {
          setStep('confirming');
          if (completionHandledRef.current) return;
          completionHandledRef.current = true;
          if (pollRef.current) clearInterval(pollRef.current);
          const successResult: PaymentResult = {
            success: true,
            referenceNumber,
            message: 'Payment confirmed!',
            timestamp: new Date().toISOString(),
            paymentMethod: 'gcash',
            amount,
          };
          setResult(successResult);
          setStep('result');
          onPaymentComplete(successResult);
          autoCloseRef.current = setTimeout(handleClose, 1500);
        } else if (['failed', 'expired', 'cancelled'].includes(data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          setResult({ success: false, referenceNumber, message: `Payment ${data.status}.`, timestamp: new Date().toISOString(), paymentMethod: 'gcash', amount });
          setStep('result');
        }
      } catch (error) {
        console.log('Polling error:', error);
      }
    };

    pollRef.current = setInterval(checkPaymentStatus, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, step, referenceNumber, amount, onPaymentComplete, onPaymentConfirmed]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateQRData = () => {
    return `${APP_URL}/payment/confirm/${referenceNumber}`;
  };

  const handleCopyReference = () => {
    navigator.clipboard.writeText(referenceNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRetry = () => {
    setStep('display');
    setResult(null);
    setTimeRemaining(300);
    setReferenceNumber('');
  };

  // ... rest of the component (same as before)

  if (step === 'confirming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="flex justify-center">
            <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mt-4">
            Verifying Payment
          </h3>
          <p className="text-sm text-gray-500 mt-2">Please wait while we confirm your payment...</p>
          <div className="mt-4 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#2d6a4f] rounded-full animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && result) {
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
            onClick={() => {
              if (result.success) {
                handleClose();
              } else {
                handleRetry();
              }
            }}
            className={`mt-6 w-full py-3 rounded-xl font-semibold transition ${
              result.success
                ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
                : 'bg-[#e76f51] text-white hover:bg-[#d45b3d]'
            }`}
          >
            {result.success ? 'Continue' : 'Try Again'}
          </button>
        </div>
      </div>
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
            <button onClick={handleClose} className="text-white/80 hover:text-white transition">
              <IoClose size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center mb-4 border border-gray-100">
            <p className="text-sm text-gray-500">Amount to Pay</p>
            <p className="text-3xl font-bold text-[#2d6a4f]">{formatCurrency(amount)}</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-md">
              <QRCodeCanvas
                value={generateQRData()}
                size={220}
                level="H"
                includeMargin={true}
                fgColor="#1a472a"
              />
            </div>

            <div className="mt-4 w-full">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                <span className="text-sm text-gray-500">Reference:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#2d6a4f]">{referenceNumber}</span>
                  <button
                    onClick={handleCopyReference}
                    className="text-gray-400 hover:text-[#2d6a4f] transition"
                  >
                    <FaCopy size={14} />
                  </button>
                </div>
              </div>
              {isCopied && (
                <p className="text-xs text-green-600 mt-1 text-center">Copied to clipboard!</p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <FaClock size={14} />
              <span>Time remaining: <span className={`font-semibold ${timeRemaining < 60 ? 'text-red-500' : 'text-[#2d6a4f]'}`}>{formatTime(timeRemaining)}</span></span>
            </div>

            {timeRemaining === 0 && (
              <button
                onClick={handleRetry}
                className="mt-4 text-sm text-[#e76f51] font-medium hover:underline"
              >
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