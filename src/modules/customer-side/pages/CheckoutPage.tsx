// src/modules/customer-side/pages/CheckoutPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../../contexts/CartContext';
import { useOrder } from '../../../contexts/OrderContext';
import { useToast } from '../components/ToastProvider';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import GCashPaymentModal from '../components/checkout/GCashPaymentModal';
import CreditCardPaymentModal from '../components/checkout/CreditCardPaymentModal';
import ScheduleModal from '../components/checkout/ScheduleModal';
import { useCheckoutForm } from '../../../hooks/useCheckoutForm';
import { geocodeAddress, OPPA_DRU_STORE_COORDS } from '../../../services/geocodingService';
import { FEES } from '../../../utils/constants';
import { cleanAddress } from '../../../utils/locationUtils';

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  referenceNumber?: string;
  message: string;
  timestamp: string;
  paymentMethod: 'gcash' | 'credit_card' | 'cash_on_delivery';
  amount: number;
}

const getAvailableDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dates.push({
      date: date,
      label: i === 0 ? 'Today' : dayNames[date.getDay()]
    });
  }
  return dates;
};

const getTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 22; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = min.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { placeOrder } = useOrder();
  const { showToast } = useToast();
  
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showGCashModal, setShowGCashModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [scheduleDisplay, setScheduleDisplay] = useState('Select date & time');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

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
  } = useCheckoutForm();

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((sum, item) => {
      const addonsTotal = item.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0;
      return sum + (item.price + addonsTotal) * item.quantity;
    }, 0);
    
    const deliveryFee = deliveryType === 'priority' ? FEES.DELIVERY.PRIORITY : FEES.DELIVERY.STANDARD;
    const serviceFee = FEES.SERVICE;
    const vatRate = FEES.VAT_RATE;
    const total = subtotal + deliveryFee + serviceFee + ((subtotal + deliveryFee + serviceFee - voucherDiscount) * vatRate);
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      vat: (subtotal + deliveryFee + serviceFee - voucherDiscount) * vatRate,
      total
    };
  };

  const placeOrderDirect = async () => {
    setIsPlacingOrder(true);
    
    try {
      const userAddress = address.street;
      const shortAddress = cleanAddress(userAddress);

      let coords = await geocodeAddress(shortAddress);

      if (!coords) {
        const cityMatch = userAddress.match(/(Dasmariñas|Imus|Bacoor|General Trias|Silang|Tagaytay|Manila|Quezon|Makati|Taguig|Cebu|Davao|Baguio)/i);
        const fallbackAddress = cityMatch ? `${cityMatch[1]}, Philippines` : 'Dasmariñas, Cavite, Philippines';
        coords = await geocodeAddress(fallbackAddress);
      }
      
      if (!coords) {
        coords = { ...OPPA_DRU_STORE_COORDS };
      }
      
      const { total } = calculateTotal();
      
      placeOrder(
        cartItems, 
        total, 
        userAddress, 
        coords, 
        paymentMethod,
        paymentReference || undefined
      );
      
      clearCart();
      showToast('Order placed successfully! 🎉', 'success');
      
      setTimeout(() => {
        navigate('/tracking');
      }, 1000);
      
    } catch (error) {
      showToast('Failed to place order. Please try again.', 'error');
      console.error('Order placement error:', error);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePaymentComplete = (result: PaymentResult) => {
    if (result.success) {
      setPaymentReference(result.referenceNumber || '');
      showToast('Payment successful!', 'success');
      setTimeout(placeOrderDirect, 1500);
    } else {
      showToast(result.message || 'Payment failed. Please try again.', 'error');
      setShowGCashModal(false);
      setShowCardModal(false);
    }
  };

  const handleScheduleConfirm = () => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      setScheduleDisplay(`${dateStr} at ${selectedTime}`);
      showToast('Schedule set successfully!', 'success');
    }
  };

  const handlePlaceOrder = () => {
    if (!address.street) {
      showToast('Please select a delivery address', 'error');
      return;
    }
    
    if (!tempPerson.fullName) {
      showToast('Please enter your full name', 'error');
      return;
    }

    if (!tempPerson.phone) {
      showToast('Please enter your phone number', 'error');
      return;
    }
    
    if (paymentMethod === 'cash_on_delivery') {
      placeOrderDirect();
      return;
    }
    
    if (paymentMethod === 'gcash') {
      setShowGCashModal(true);
      return;
    }
    
    if (paymentMethod === 'credit_card') {
      setShowCardModal(true);
      return;
    }
  };

  const { total } = calculateTotal();

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
            <FiShoppingCart className="text-7xl text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some delicious Korean fried chicken to your order!</p>
            <button
              onClick={() => navigate('/customer')}
              className="px-8 py-3 bg-[#e76f51] text-white rounded-xl font-semibold hover:bg-[#d45b3d] transition-colors"
            >
              Browse Menu →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#e76f51]/20">
          <button 
            onClick={() => navigate('/customer')} 
            className="flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-sm font-medium">Back to Menu</span>
          </button>
          <span className="text-gray-300 text-xl">|</span>
          <h1 className="text-xl font-bold text-[#2d6a4f]">Review and place your order</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CheckoutForm 
              address={address}
              updateAddress={updateAddress}
              tempPerson={tempPerson}
              updatePerson={updatePerson}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              scheduleDisplay={scheduleDisplay}
              onScheduleClick={() => setShowScheduleModal(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              deliveryType={deliveryType}
              onPlaceOrder={handlePlaceOrder}
              onVoucherApply={() => {}}
              voucherDiscount={voucherDiscount}
              isPlacingOrder={isPlacingOrder}
            />
          </div>
        </div>
      </div>

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedDate(null);
          setSelectedTime(null);
        }}
        availableDates={getAvailableDates()}
        timeSlots={getTimeSlots()}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
        onConfirm={() => {
          handleScheduleConfirm();
          setShowScheduleModal(false);
        }}
      />

      <GCashPaymentModal
        isOpen={showGCashModal}
        onClose={() => setShowGCashModal(false)}
        amount={total}
        onPaymentComplete={handlePaymentComplete}
      />

      <CreditCardPaymentModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        amount={total}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
};

export default CheckoutPage;