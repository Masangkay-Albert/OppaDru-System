import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaWallet } from 'react-icons/fa';

// Use production API URL - no localhost fallback
const API_URL = 'https://oppadru-system.onrender.com/api';

const PaymentConfirmPage: React.FC = () => {
  const { reference } = useParams<{ reference: string }>();
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState(parseFloat(searchParams.get('amount') || '0'));
  const [status, setStatus] = useState<'confirming' | 'loading' | 'success' | 'error'>('confirming');
  const [message, setMessage] = useState<string>('');

  // Fetch order data when page loads
  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        console.log('Fetching order data for reference:', reference);
        const response = await fetch(`${API_URL}/payment/order/${reference}?amount=${amount}`);
        const data = await response.json();
        
        if (data.success) {
          setAmount(data.order.amount);
          console.log('Order data fetched:', data.order);
        } else {
          console.error('Failed to fetch order data:', data);
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
        // Still proceed with the amount from URL parameter
      }
    };

    if (reference) {
      fetchOrderData();
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/payment/status/${reference}`);
        const data = await response.json();
        if (!active) return;
        if (data.amount) setAmount(data.amount);
        if (data.status === 'paid') {
          setStatus('success');
          setMessage('Payment confirmed by GCash.');
        } else if (['failed', 'cancelled'].includes(data.status)) {
          setStatus('error');
          setMessage(`Payment ${data.status}.`);
        } else if (data.status === 'expired') {
          setStatus('error');
          setMessage('Payment expired. Please generate a new QR code.');
        } else {
          setStatus('confirming');
          setMessage('Waiting for GCash payment confirmation...');
        }
      } catch {
        if (active) setMessage('Unable to retrieve payment status.');
      }
    };
    const timer = setInterval(checkStatus, 2000);
    checkStatus();
    return () => { active = false; clearInterval(timer); };
  }, [reference]);

  const handleConfirm = async () => {
    if (!reference) return;

    setStatus('loading');
    setMessage('Confirming your payment...');

    try {
      const response = await fetch(`${API_URL}/payment/confirm/${reference}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Payment confirmation failed.');
      }

      setAmount(Number(data.amount));
      setStatus('success');
      setMessage('Payment confirmed successfully.');
      window.opener?.postMessage({
        type: 'GCASH_PAYMENT_CONFIRMED',
        reference,
      }, window.location.origin);
      localStorage.setItem(`gcash_payment_confirmed_${reference}`, Date.now().toString());
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Payment confirmation failed.');
    }
  };

  const formatCurrency = (amt: number) => {
    return `₱${amt.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="flex justify-center">
            <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mt-4">Processing Payment</h3>
          <p className="text-sm text-gray-500 mt-2">{message}</p>
          <div className="mt-4 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#2d6a4f] rounded-full animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center">
            <FaCheckCircle className="text-5xl text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-green-600 mt-4">Payment Confirmed!</h3>
          <p className="text-gray-600 mt-2">{message}</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Reference</p>
            <p className="font-mono font-bold text-[#2d6a4f] mt-1">{reference}</p>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Amount</p>
            <p className="text-xl font-bold text-[#2d6a4f]">{formatCurrency(amount)}</p>
          </div>
          <p className="text-xs text-gray-400 mt-4">This window will close automatically...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center">
            <FaTimesCircle className="text-5xl text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-red-600 mt-4">Payment Failed</h3>
          <p className="text-gray-600 mt-2">{message}</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl text-left">
            <p className="text-xs text-gray-500">Debug Info:</p>
            <p className="text-xs text-gray-400 mt-1">Reference: {reference}</p>
            <p className="text-xs text-gray-400">Amount: {formatCurrency(amount)}</p>
            <p className="text-xs text-gray-400">API: {API_URL}</p>
          </div>
          <button
            onClick={handleConfirm}
            className="mt-6 w-full py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4332] transition shadow-lg shadow-[#2d6a4f]/30"
          >
            Try Again
          </button>
          <button
            onClick={() => window.close()}
            className="mt-3 w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 rounded-full mx-auto flex items-center justify-center">
            <FaWallet className="text-3xl text-[#2d6a4f]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mt-4">GCash Payment</h2>
          <p className="text-sm text-gray-500 mt-1">Confirm your payment</p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Merchant</span>
            <span className="font-medium">Oppa Dru Korean Fried Chicken</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Reference</span>
            <span className="font-mono font-bold text-sm">{reference}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-[#2d6a4f] text-lg">{formatCurrency(amount)}</span>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="mt-6 w-full py-3.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4332] transition shadow-lg shadow-[#2d6a4f]/30"
        >
            Confirm Payment
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          By confirming, you agree to pay the amount shown above.
        </p>
      </div>
    </div>
  );
};

export default PaymentConfirmPage;