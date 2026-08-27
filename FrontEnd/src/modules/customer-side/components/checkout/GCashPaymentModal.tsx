import React, { useState, useEffect } from 'react';
import { 
  FaMobileAlt, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaWallet,
  FaSpinner,
  FaQrcode,
  FaCopy,
  FaClock,
} from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { usePayment } from '../../../../hooks/usePayment';
import { QRCodeCanvas } from 'qrcode.react';

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
}

type Step = 'display' | 'confirming' | 'result';

const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete,
  onPaymentConfirmed
}) => {
  const [step, setStep] = useState<Step>('display');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(300);
  const [isCopied, setIsCopied] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const {
    isProcessing,
    result,
    confirmQRPayment,
    formatCurrency,
    reset
  } = usePayment();

  useEffect(() => {
    if (isOpen) {
      const ref = `OPPA-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      setReferenceNumber(ref);
      setTimeRemaining(300);
      setStep('display');
      setIsCopied(false);
      reset();
      setIsPolling(false);
    }
  }, [isOpen, reset]);

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
        const response = await fetch(`http://localhost:8000/api/payment/status/${referenceNumber}`);
        const data = await response.json();
        
        if (data.confirmed) {
          setIsPolling(false);
          setStep('confirming');
          const paymentResult = await confirmQRPayment(referenceNumber, amount);
          if (paymentResult) {
            setStep('result');
            if (paymentResult.success) {
              if (onPaymentConfirmed) {
                onPaymentConfirmed();
              }
              onPaymentComplete(paymentResult);
            }
          }
        }
      } catch (error) {
        console.log('Polling error:', error);
      }
    };

    if (!isPolling) {
      setIsPolling(true);
      const interval = setInterval(checkPaymentStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, step, referenceNumber, amount, confirmQRPayment, onPaymentComplete, onPaymentConfirmed, isPolling]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateQRData = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/payment/confirm/${referenceNumber}`;
  };

  const handleCopyReference = () => {
    navigator.clipboard.writeText(referenceNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('display');
    reset();
    onClose();
  };

  const handleRetry = () => {
    setStep('display');
    reset();
    const ref = `OPPA-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setReferenceNumber(ref);
    setTimeRemaining(300);
  };

  if (isProcessing) {
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

  if (result) {
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
          <div className="text-center mt-1">
            <p className="text-white/80 text-xs">Scan the QR code with your GCash app</p>
          </div>
        </div>

        <div className="p-6">
          {step === 'display' ? (
            <>
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

                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 w-full">
                  <h4 className="text-sm font-semibold text-blue-800">How to pay using GCash:</h4>
                  <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Open your GCash app</li>
                    <li>Tap "Pay QR" or "Scan to Pay"</li>
                    <li>Scan the QR code above</li>
                    <li>You will be redirected to confirmation page</li>
                    <li>Click "Confirm Payment" on your phone</li>
                    <li>This modal will close automatically</li>
                  </ol>
                </div>

                <div className="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200 w-full">
                  <p className="text-xs text-yellow-700 flex items-center gap-2">
                    <FaQrcode size={14} />
                    <span>QR contains: {generateQRData()}</span>
                  </p>
                </div>

                {timeRemaining === 0 && (
                  <button
                    onClick={handleRetry}
                    className="mt-2 text-sm text-[#e76f51] font-medium hover:underline"
                  >
                    Generate new QR code
                  </button>
                )}
              </div>
            </>
          ) : step === 'confirming' ? (
            <>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#2d6a4f]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaSpinner className="text-3xl text-[#2d6a4f] animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Waiting for Confirmation</h3>
                <p className="text-sm text-gray-500 mt-1">Please confirm payment on your mobile...</p>
                <p className="text-xs text-gray-400 mt-3">Reference: {referenceNumber}</p>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <FaWallet size={12} className="text-[#2d6a4f]" />
            <span>Powered by GCash • Secure QR Payment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCashPaymentModal;