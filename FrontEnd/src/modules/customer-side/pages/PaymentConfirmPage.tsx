import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaWallet } from 'react-icons/fa';

const PaymentConfirmPage: React.FC = () => {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error'>('loading');
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/payment/order/${reference}`);
        const data = await response.json();
        if (data.success) {
          setOrderData(data.order);
          setStatus('confirming');
        } else {
          setStatus('error');
        }
      } catch (error) {
        setStatus('error');
      }
    };

    if (reference) {
      fetchOrderDetails();
    }
  }, [reference]);

  const handleConfirm = async () => {
    setStatus('loading');
    try {
      const response = await fetch(`http://localhost:8000/api/payment/confirm/${reference}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setStatus('success');
        setTimeout(() => {
          window.close();
        }, 3000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="flex justify-center">
            <FaSpinner className="text-5xl text-[#2d6a4f] animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mt-4">Loading...</h3>
          <p className="text-sm text-gray-500 mt-2">Please wait</p>
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
          <p className="text-gray-500 mt-2">Your payment has been successfully processed.</p>
          <p className="text-xs text-gray-400 mt-4">This window will close automatically...</p>
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">Reference: <span className="font-mono font-bold">{reference}</span></p>
          </div>
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
          <p className="text-gray-500 mt-2">Something went wrong. Please try again.</p>
          <button
            onClick={() => window.close()}
            className="mt-6 w-full py-3 bg-[#e76f51] text-white rounded-xl font-semibold"
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

        {orderData && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Merchant</span>
              <span className="font-medium">{orderData.merchant || 'Oppa Dru Korean Fried Chicken'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Reference</span>
              <span className="font-mono font-bold text-sm">{reference}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-[#2d6a4f] text-lg">{formatCurrency(orderData.amount || 0)}</span>
            </div>
          </div>
        )}

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