// src/modules/customer-side/pages/CheckoutPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/Authcontext';
import NavbarCustomer from '../components/NavbarCustomer';
import CheckoutForm from '../components/CheckoutForm';
import CheckoutSummary from '../components/CheckoutSummary';

export interface Address {
  street: string;
  floor: string;
  note: string;
}

export interface TempPerson {
  fullName: string;
  email: string;
  phone: string;
}

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, clearCart } = useCart();
  
  const [address, setAddress] = useState<Address>({
    street: '',
    floor: '',
    note: ''
  });
  
  const [tempPerson, setTempPerson] = useState<TempPerson>({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: ''
  });
  
  const [deliveryType, setDeliveryType] = useState<'standard' | 'priority'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash_on_delivery');
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);

  const handlePlaceOrder = () => {
    if (!address.street) {
      alert('Please select your delivery address');
      return;
    }
    
    clearCart();
    alert('Order placed successfully!');
    navigate('/customer');
  };

  const handleBackToMenu = () => {
    navigate('/customer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#e76f51]/20">
          <button 
            onClick={handleBackToMenu}
            className="flex items-center gap-1 text-gray-500 hover:text-[#2d6a4f] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back to Menu</span>
          </button>
          
          <span className="text-gray-300 text-lg">|</span>
          
          <h1 className="text-xl font-bold text-[#2d6a4f]">Review and place your order</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Forms */}
          <div className="lg:col-span-2">
            <CheckoutForm 
              address={address}
              setAddress={setAddress}
              cartItems={cartItems}
              tempPerson={tempPerson}
              setTempPerson={setTempPerson}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              appliedVoucher={appliedVoucher}
              setAppliedVoucher={setAppliedVoucher}
            />
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              deliveryType={deliveryType}
              appliedVoucher={appliedVoucher}
              onPlaceOrder={handlePlaceOrder}
            />
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;