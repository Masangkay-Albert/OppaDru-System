// src/modules/customer-side/pages/CheckoutPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../contexts/CartContext';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import { useCheckoutForm } from '../../../hooks/useCheckoutForm';
import { geocodeAddress } from '../../../services/geocodingService';

// Helper function to shorten address for geocoding
const shortenAddressForGeocoding = (address: string): string => {
  // Remove "Philippines" if present
  let shortened = address.replace(', Philippines', '');
  
  // Remove postal code (5 digits)
  shortened = shortened.replace(/\b\d{4}\b/g, '');
  
  // Get the first 3 parts of the address
  const parts = shortened.split(',');
  if (parts.length > 3) {
    shortened = parts.slice(0, 3).join(',');
  }
  
  // Clean up extra spaces and commas
  shortened = shortened.replace(/\s+/g, ' ').trim();
  shortened = shortened.replace(/,\s*,/g, ',');
  
  return shortened;
};

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { placeOrder } = useOrder();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  
  const {
    address,
    updateAddress,
    tempPerson,
    updatePerson,
    deliveryType,
    setDeliveryType,
    paymentMethod,
    setPaymentMethod,
    voucherDiscount,
    setVoucherDiscount,
    isValid
  } = useCheckoutForm();

  const handlePlaceOrder = async () => {
    if (!address.street) {
      alert('Please enter your delivery address');
      return;
    }
    
    if (!tempPerson.fullName) {
      alert('Please enter your full name');
      return;
    }
    
    setIsPlacingOrder(true);
    
    try {
      const userAddress = address.street;
      
      // Shorten the address for geocoding
      const shortAddress = shortenAddressForGeocoding(userAddress);
      
      // Try to geocode with shortened address
      let coords = await geocodeAddress(shortAddress);
      
      // If still fails, try with city only
      if (!coords) {
        coords = await geocodeAddress('Dasmariñas, Cavite');
      }
      
      if (!coords) {
        // Use store coordinates as last resort
        coords = { lat: 14.322, lng: 120.958 };
      }
      
      const subtotal = cartItems.reduce((sum, item) => {
        const addonsTotal = item.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0;
        return sum + (item.price + addonsTotal) * item.quantity;
      }, 0);
      
      const deliveryFee = deliveryType === 'priority' ? 99 : 49;
      const total = subtotal + deliveryFee + 29 + ((subtotal + deliveryFee + 29 - voucherDiscount) * 0.12);
      
      placeOrder(cartItems, total, userAddress, coords);
      clearCart();
      navigate('/tracking');
    } catch {
      alert('There was an error placing your order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#e76f51]/20">
          <button onClick={() => navigate('/customer')} className="flex items-center gap-1 text-gray-500 hover:text-[#2d6a4f] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back to Menu</span>
          </button>
          <span className="text-gray-300 text-lg">|</span>
          <h1 className="text-xl font-bold text-[#2d6a4f]">Review and place your order</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CheckoutForm 
              address={address}
              updateAddress={updateAddress}
              cartItems={cartItems}
              tempPerson={tempPerson}
              updatePerson={updatePerson}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
            />
          </div>

          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              deliveryType={deliveryType}
              onPlaceOrder={handlePlaceOrder}
              onVoucherApply={setVoucherDiscount}
              voucherDiscount={voucherDiscount}
              isPlacingOrder={isPlacingOrder}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;