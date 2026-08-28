import React, { useState } from 'react';
import { 
  FaCreditCard, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaLock, 
  FaCcVisa, 
  FaCcMastercard, 
  FaCcAmex, 
  FaCcDiscover,
  FaUser,
  FaCalendarAlt,
  FaShieldAlt,
  FaSpinner
} from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { HiOutlineCreditCard } from 'react-icons/hi';
import { usePayment } from '../../../../hooks/usePayment';
import type { CartItem } from '../../../../types/product.types';

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
  items: CartItem[];
  deliveryType: 'standard' | 'priority';
  onPaymentComplete: (result: PaymentResult) => void;
}

const CreditCardPaymentModal: React.FC<CreditCardPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentComplete,
  items,
  deliveryType
}) => {
  const [form, setForm] = useState({
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    const response = await processCard({
      cardNumber: form.cardNumber.replace(/\s/g, ''),
      cardHolderName: form.cardHolderName,
      expiryMonth: form.expiryMonth,
      expiryYear: form.expiryYear,
      cvv: form.cvv,
      amount,
      items,
      deliveryType
    });
    setIsLoading(false);
    if (response?.success) {
      onPaymentComplete(response);
    }
  };

  const handleClose = () => {
    setForm({ cardNumber: '', cardHolderName: '', expiryMonth: '', expiryYear: '', cvv: '' });
    reset();
    onClose();
  };

  const getCardType = () => {
    const clean = form.cardNumber.replace(/\s/g, '');
    if (clean.startsWith('4')) return { icon: FaCcVisa, name: 'Visa', color: '#1a1f71' };
    if (clean.startsWith('5')) return { icon: FaCcMastercard, name: 'Mastercard', color: '#eb001b' };
    if (clean.startsWith('3')) return { icon: FaCcAmex, name: 'American Express', color: '#006fcf' };
    if (clean.startsWith('6')) return { icon: FaCcDiscover, name: 'Discover', color: '#ff6000' };
    return null;
  };

  const cardType = getCardType();
  const CardIcon = cardType?.icon || HiOutlineCreditCard;

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin mx-auto" />
          <h3 className="text-xl font-semibold text-gray-800 mt-4">Processing Payment</h3>
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
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <FaCreditCard className="text-white text-xl" />
              </div>
              <span className="text-white font-bold text-lg">Credit / Debit Card</span>
            </div>
            <button onClick={handleClose} className="text-white/60 hover:text-white transition">
              <IoClose size={24} />
            </button>
          </div>
          <p className="text-white/60 text-sm mt-1">Enter your card details securely</p>
        </div>

        <div className="p-6">
          {/* Amount Display */}
          <div className="bg-gray-50 rounded-xl p-3 text-center mb-4 border border-gray-100">
            <p className="text-xs text-gray-500">Amount to Pay</p>
            <p className="text-2xl font-bold text-[#2d6a4f]">{formatCurrency(amount)}</p>
          </div>

          {/* Card Preview */}
          <div className="relative mb-5">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 text-white min-h-[160px] shadow-lg">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <FaShieldAlt className="text-white/60 text-sm" />
                  <span className="text-white/60 text-xs font-medium">Secure</span>
                </div>
                <CardIcon size={32} className="text-white/80" />
              </div>
              
              <div className="mt-4">
                <p className="font-mono text-lg tracking-wider">
                  {form.cardNumber || '•••• •••• •••• ••••'}
                </p>
              </div>
              
              <div className="flex justify-between text-xs mt-4">
                <div>
                  <p className="text-white/50">Card Holder</p>
                  <p className="font-semibold uppercase tracking-wide text-sm">
                    {form.cardHolderName || 'FULL NAME'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/50">Expires</p>
                  <p className="font-semibold">
                    {form.expiryMonth || 'MM'}/{form.expiryYear.slice(-2) || 'YY'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FaCreditCard size={16} />
                </div>
                <input
                  type="text"
                  value={form.cardNumber}
                  onChange={(e) => handleChange('cardNumber', e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition text-lg tracking-wider ${
                    isFocused === 'cardNumber' ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'
                  }`}
                  maxLength={19}
                  onFocus={() => setIsFocused('cardNumber')}
                  onBlur={() => setIsFocused(null)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Card Holder Name</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FaUser size={16} />
                </div>
                <input
                  type="text"
                  value={form.cardHolderName}
                  onChange={(e) => handleChange('cardHolderName', e.target.value.toUpperCase())}
                  placeholder="JOHN DOE"
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition uppercase ${
                    isFocused === 'cardHolderName' ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'
                  }`}
                  onFocus={() => setIsFocused('cardHolderName')}
                  onBlur={() => setIsFocused(null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <FaCalendarAlt size={14} />
                    </div>
                    <input
                      type="text"
                      value={form.expiryMonth}
                      onChange={(e) => handleChange('expiryMonth', e.target.value)}
                      placeholder="MM"
                      className={`w-full pl-8 pr-2 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none transition ${
                        isFocused === 'expiry' ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'
                      }`}
                      maxLength={2}
                      onFocus={() => setIsFocused('expiry')}
                      onBlur={() => setIsFocused(null)}
                    />
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={form.expiryYear}
                      onChange={(e) => handleChange('expiryYear', e.target.value)}
                      placeholder="YYYY"
                      className={`w-full px-2 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none transition ${
                        isFocused === 'expiry' ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'
                      }`}
                      maxLength={4}
                      onFocus={() => setIsFocused('expiry')}
                      onBlur={() => setIsFocused(null)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
                <div className="relative">
                  <input
                    type="password"
                    value={form.cvv}
                    onChange={(e) => handleChange('cvv', e.target.value)}
                    placeholder="•••"
                    className={`w-full px-3 py-3 border-2 rounded-xl text-center focus:border-[#2d6a4f] focus:outline-none transition ${
                      isFocused === 'cvv' ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'
                    }`}
                    maxLength={4}
                    onFocus={() => setIsFocused('cvv')}
                    onBlur={() => setIsFocused(null)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <FaLock className="text-[#2d6a4f]" size={14} />
            <span>Your payment information is secure and encrypted</span>
          </div>

          {/* Pay Button */}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || isLoading}
            className={`mt-4 w-full py-3.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
              isFormValid() && !isLoading
                ? 'bg-[#2d6a4f] text-white hover:bg-[#1b4332] shadow-lg shadow-[#2d6a4f]/30'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaShieldAlt size={18} />
            )}
            {isLoading ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditCardPaymentModal;