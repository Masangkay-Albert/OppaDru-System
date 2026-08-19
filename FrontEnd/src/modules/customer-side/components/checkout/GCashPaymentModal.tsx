import React, { useState, useRef, useEffect } from 'react';
import { 
  FaMobileAlt, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaShieldAlt, 
  FaRedo, 
  FaWallet,
  FaPhoneAlt,
  FaLock,
  FaSpinner
} from 'react-icons/fa';
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
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    const response = await requestGCashOTP(mobileNumber);
    setIsLoading(false);
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
    setIsLoading(true);
    const response = await processGCash(mobileNumber, enteredOtp, issuedOtp, amount);
    setIsLoading(false);
    if (response?.success) {
      onPaymentComplete(response);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    const response = await requestGCashOTP(mobileNumber);
    setIsLoading(false);
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
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="flex justify-center">
            <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mt-4">
            {isSendingOtp ? 'Sending Code' : 'Processing Payment'}
          </h3>
          <p className="text-sm text-gray-500 mt-2">Please wait...</p>
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
                reset();
                setStep('number');
                setOtpDigits(Array(6).fill(''));
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
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#1a472a] to-[#2d6a4f] px-6 py-5">
          <div className="flex items-center justify-between">
            {step === 'otp' && (
              <button
                onClick={() => setStep('number')}
                className="text-white/80 hover:text-white transition"
              >
                <IoArrowBack size={24} />
              </button>
            )}
            <div className="flex items-center gap-3 mx-auto">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FaMobileAlt className="text-white text-xl" />
              </div>
              <span className="text-white font-bold text-lg">GCash</span>
            </div>
            <button onClick={handleClose} className="text-white/80 hover:text-white transition">
              <IoClose size={24} />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-white/80 text-sm">Pay securely using your GCash account</p>
          </div>
        </div>

        <div className="p-6">
          {step === 'number' ? (
            <>
              {/* Amount Display */}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-6 border border-gray-100">
                <p className="text-sm text-gray-500">Amount to Pay</p>
                <p className="text-3xl font-bold text-[#2d6a4f]">{formatCurrency(amount)}</p>
              </div>

              {/* Mobile Number Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <FaPhoneAlt size={16} />
                  </div>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\s/g, ''))}
                    placeholder="09123456789"
                    className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition text-lg"
                    maxLength={11}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400">Enter your GCash registered mobile number</p>
                {otpError && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <FaTimesCircle size={12} /> {otpError}
                  </p>
                )}
              </div>

              {/* Demo Info */}
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-600 flex items-center gap-2">
                  <FaShieldAlt size={14} />
                  <span>Demo: OTP will be shown after clicking "Send Code"</span>
                </p>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendOtp}
                disabled={!mobileNumber || isLoading}
                className={`mt-5 w-full py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                  mobileNumber && !isLoading
                    ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332] shadow-lg shadow-[#2d6a4f]/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaShieldAlt size={18} />
                )}
                {isLoading ? 'Sending...' : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              {/* OTP Verification */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#2d6a4f]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FaShieldAlt className="text-3xl text-[#2d6a4f]" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Verify It's You</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-semibold text-[#2d6a4f]">{mobileNumber}</span>
                </p>
              </div>

              {/* OTP Inputs */}
              <div className="flex justify-center gap-2">
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
                    className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 transition"
                  />
                ))}
              </div>

              {/* OTP Error */}
              {otpError && (
                <p className="text-center text-xs text-red-500 mt-2">{otpError}</p>
              )}

              {/* Resend & Demo Code */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-xs">
                  {resendTimer > 0 ? (
                    <span className="text-gray-400">Resend in {resendTimer}s</span>
                  ) : (
                    <button
                      onClick={handleResend}
                      className="text-[#2d6a4f] font-medium flex items-center gap-1 hover:underline"
                    >
                      <FaRedo size={12} /> Resend Code
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-lg">
                  Demo code: <span className="font-mono font-bold text-[#2d6a4f]">{issuedOtp}</span>
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={otpDigits.some(d => !d) || isLoading}
                className={`mt-5 w-full py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                  otpDigits.every(d => d) && !isLoading
                    ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332] shadow-lg shadow-[#2d6a4f]/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaWallet size={18} />
                )}
                {isLoading ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
              </button>
            </>
          )}
        </div>

        {/* Secure Footer */}
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <FaLock size={12} className="text-[#2d6a4f]" />
            <span>Your payment is secure and encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCashPaymentModal;