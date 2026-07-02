// src/modules/customer-side/components/checkout/GCashPaymentModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FaMobileAlt, FaCheckCircle, FaTimesCircle, FaShieldAlt, FaRedo } from 'react-icons/fa';
import { IoClose, IoArrowBack } from 'react-icons/io5';
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

type Step = 'number' | 'otp';

const RESEND_SECONDS = 30;

const GCashPaymentModal: React.FC<GCashPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete
}) => {
  const [step, setStep] = useState<Step>('number');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [issuedOtp, setIssuedOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    isSendingOtp,
    isProcessing,
    result,
    requestGCashOTP,
    processGCash,
    formatCurrency,
    reset
  } = usePayment();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setOtpError('');
    const response = await requestGCashOTP(mobileNumber);
    if (response.success && response.otp) {
      setIssuedOtp(response.otp);
      setOtpDigits(Array(6).fill(''));
      setStep('otp');
      setResendTimer(RESEND_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } else {
      setOtpError(response.message);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredOtp = otpDigits.join('');
    const response = await processGCash(mobileNumber, enteredOtp, issuedOtp, amount);
    if (response?.success) {
      onPaymentComplete(response);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const response = await requestGCashOTP(mobileNumber);
    if (response.success && response.otp) {
      setIssuedOtp(response.otp);
      setOtpDigits(Array(6).fill(''));
      setResendTimer(RESEND_SECONDS);
      otpRefs.current[0]?.focus();
    }
  };

  const handleClose = () => {
    setStep('number');
    setMobileNumber('');
    setOtpDigits(Array(6).fill(''));
    setIssuedOtp('');
    setOtpError('');
    setResendTimer(0);
    reset();
    onClose();
  };

  if (isProcessing || isSendingOtp) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#2d6a4f] mx-auto" />
          <h3 className="text-xl font-semibold text-gray-800 mt-4">
            {isSendingOtp ? 'Sending Code' : 'Processing Payment'}
          </h3>
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
                setStep('number');
                setOtpDigits(Array(6).fill(''));
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
        {step === 'otp' && (
          <button
            onClick={() => setStep('number')}
            className="absolute left-6 top-6 text-gray-400 hover:text-gray-600"
          >
            <IoArrowBack size={22} />
          </button>
        )}
        <button onClick={handleClose} className="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
          <IoClose size={24} />
        </button>

        {step === 'number' && (
          <>
            <div className="text-center pt-2">
              <FaMobileAlt className="text-5xl text-[#2d6a4f] mx-auto mb-3" />
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
              {otpError && <p className="text-xs text-red-500 mt-1">{otpError}</p>}
            </div>

            <button
              onClick={handleSendOtp}
              disabled={!mobileNumber}
              className={`mt-4 w-full py-3 rounded-xl font-semibold transition ${
                mobileNumber
                  ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Send Code
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="text-center pt-2">
              <FaShieldAlt className="text-5xl text-[#2d6a4f] mx-auto mb-3" />
              <h3 className="text-xl font-bold text-gray-800">Verify It's You</h3>
              <p className="text-sm text-gray-500 mt-1">
                Enter the 6-digit code sent to <span className="font-semibold">{mobileNumber}</span>
              </p>
            </div>

            <div className="flex justify-center gap-2 mt-5">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  maxLength={1}
                  className="w-11 h-13 py-3 text-center text-lg font-bold border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none"
                />
              ))}
            </div>

            <div className="text-center mt-4">
              {resendTimer > 0 ? (
                <p className="text-xs text-gray-400">Resend code in {resendTimer}s</p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-xs text-[#2d6a4f] font-medium flex items-center gap-1 mx-auto hover:underline"
                >
                  <FaRedo size={10} /> Resend Code
                </button>
              )}
            </div>

            <div className="mt-3 text-xs text-center text-gray-400 bg-gray-50 p-2 rounded-lg">
              Demo mode — your code is <span className="font-mono font-bold">{issuedOtp}</span>
            </div>

            <button
              onClick={handleVerify}
              disabled={otpDigits.some(d => !d)}
              className={`mt-4 w-full py-3 rounded-xl font-semibold transition ${
                otpDigits.every(d => d)
                  ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Verify & Pay {formatCurrency(amount)}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GCashPaymentModal;