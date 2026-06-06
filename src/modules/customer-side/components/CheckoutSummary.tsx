// src/modules/customer-side/components/CheckoutSummary.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../../types/product.types';

interface Props {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority';
  appliedVoucher: any;
  onPlaceOrder: () => void;
}

const DELIVERY_FEES = { standard: 0, priority: 99 };
const SERVICE_FEE = 29;
const VAT_RATE = 0.12;

const CheckoutSummary: React.FC<Props> = ({ 
  cartItems, deliveryType, appliedVoucher, onPlaceOrder 
}) => {
  const navigate = useNavigate();
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);

  const calculateItemTotal = (item: CartItem) => {
    const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
    return (item.price + addonsTotal) * item.quantity;
  };

  const subtotal = cartItems.reduce((sum, i) => sum + calculateItemTotal(i), 0);
  const deliveryFee = DELIVERY_FEES[deliveryType];
  const subtotalWithFees = subtotal + deliveryFee + SERVICE_FEE;
  const totalAfterVoucher = subtotalWithFees - voucherDiscount;
  const vat = totalAfterVoucher * VAT_RATE;
  const total = totalAfterVoucher + vat;

  const handleApplyVoucher = () => {
    if (voucherCode.toUpperCase() === 'OPPA10') {
      setVoucherDiscount(10);
      setVoucherError('');
    } else if (voucherCode.toUpperCase() === 'OPPA20') {
      if (subtotal >= 1000) {
        setVoucherDiscount(20);
        setVoucherError('');
      } else {
        setVoucherError('Minimum order of ₱1,000 required');
      }
    } else {
      setVoucherError('Invalid voucher code');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Your order from</h2>
      </div>
      
      <p className="text-gray-800 font-medium mb-4">Oppa Dru Korean Fried Chicken</p>

      {/* Order Items */}
      <div className="space-y-3 mb-4">
        {cartItems.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">{item.quantity}x {item.name}</span>
              <span className="font-medium text-gray-800">₱{calculateItemTotal(item)}</span>
            </div>
            {item.selectedAddons && item.selectedAddons.length > 0 && (
              <div className="text-xs text-gray-400 ml-4">
                {item.selectedAddons.map(a => `+ ${a.name}`).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/customer')} className="text-[#e76f51] text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        + Add more items
      </button>

      {/* Vouchers Section */}
      <div className="border-t border-gray-100 pt-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 110 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 110-4V7a2 2 0 012-2z" />
          </svg>
          <h3 className="font-medium text-gray-800">Vouchers</h3>
        </div>
        
        {voucherDiscount > 0 && (
          <div className="mb-3 p-3 bg-[#d8f3dc] rounded-xl flex justify-between items-center">
            <div>
              <p className="font-medium text-[#2d6a4f]">Voucher Applied</p>
              <p className="text-xs text-gray-500">₱{voucherDiscount} off</p>
            </div>
            <button onClick={() => setVoucherDiscount(0)} className="text-red-500 text-sm">Remove</button>
          </div>
        )}
        
        <div className="flex gap-2">
          <input 
            type="text" 
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            placeholder="Enter voucher code (OPPA10 or OPPA20)"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#e76f51]"
          />
          <button 
            onClick={handleApplyVoucher}
            className="px-4 py-2 bg-[#2d6a4f] text-white rounded-xl text-sm font-medium hover:bg-[#1b4d3e] transition"
          >
            Apply
          </button>
        </div>
        {voucherError && <p className="text-red-500 text-xs mt-2">{voucherError}</p>}
      </div>

      {/* Price Summary */}
      <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-gray-800">₱{subtotal}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Delivery fee</span><span className="text-gray-800">{deliveryFee === 0 ? 'Free' : `₱${deliveryFee}`}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Service fee</span><span className="text-gray-800">₱{SERVICE_FEE}</span></div>
        {voucherDiscount > 0 && <div className="flex justify-between text-[#2d6a4f]"><span>Voucher discount</span><span>- ₱{voucherDiscount}</span></div>}
        <div className="flex justify-between"><span className="text-gray-500">VAT (12%)</span><span className="text-gray-800">₱{Math.round(vat)}</span></div>
        <div className="border-t border-gray-100 pt-2 mt-2">
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-[#2d6a4f]">₱{Math.round(total)}</span>
          </div>
          <p className="text-xs text-gray-400 text-right">(inc. fees and tax)</p>
        </div>
      </div>

      <button 
        onClick={onPlaceOrder} 
        className="w-full mt-6 py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition"
      >
        Place order
      </button>
    </div>
  );
};

export default CheckoutSummary;