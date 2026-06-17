// src/modules/customer-side/components/checkout/CheckoutForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../../../../types/product.types';
import PersonalDetailsForm from './PersonalDetailsForm';
import DeliveryOptions from './DeliveryOptions';
import PaymentMethods from './PaymentMethods';
import ScheduleModal from './ScheduleModal';
import LocationPicker from '../common/LocationPicker';
import type { Address, TempPerson } from '../../../../hooks/useCheckoutForm';
import { useDeliveryOptions } from '../../../../hooks/useDeliveryOptions';

interface CheckoutFormProps {
  address: Address;
  updateAddress: (field: keyof Address, value: string) => void;
  cartItems: CartItem[];
  tempPerson: TempPerson;
  updatePerson: (field: keyof TempPerson, value: string) => void;
  deliveryType: 'standard' | 'priority';
  setDeliveryType: (type: 'standard' | 'priority') => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  address,
  updateAddress,
  cartItems,
  tempPerson,
  updatePerson,
  setDeliveryType,
  paymentMethod,
  setPaymentMethod
}) => {
  const navigate = useNavigate();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const {
    deliveryOption,
    setDeliveryOption,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    showSchedule,
    setShowSchedule,
    availableDates,
    timeSlots,
    getScheduleDisplay,
    confirmSchedule
  } = useDeliveryOptions();

  const handleLocationSelect = (location: {
    lat: number;
    lng: number;
    address: string;
    name: string;
  }) => {
    const fullAddress = location.address || location.name;
    
    if (fullAddress) {
      updateAddress('street', fullAddress);
    }
    setShowLocationPicker(false);
  };

  const handleDeliveryOptionChange = (
    option: 'standard' | 'priority' | 'scheduled'
  ) => {
    if (option === 'scheduled') {
      setShowSchedule(true);
    } else {
      setDeliveryOption(option);
      setDeliveryType(option);
    }
  };

  const getDisplayAddress = () => {
    if (!address.street) return 'No address selected';
    return address.street;
  };

  if (cartItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <p className="text-gray-500 font-medium">Your cart is empty</p>
        <button
          onClick={() => navigate('/customer')}
          className="mt-4 px-6 py-2 bg-[#e76f51] text-white rounded-full font-medium"
        >
          Continue shopping →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PersonalDetailsForm
        tempPerson={tempPerson}
        onUpdatePerson={updatePerson}
      />
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#2d6a4f]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Delivery Address</h2>
          </div>
          <button
            onClick={() => setShowLocationPicker(true)}
            className="text-[#e76f51] text-sm font-medium hover:underline"
          >
            Edit
          </button>
        </div>

        {address.street ? (
          <div className="mb-4 p-3 bg-[#d8f3dc] rounded-xl">
            <p className="text-gray-800 font-medium break-words">{getDisplayAddress()}</p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-4">
            No address selected. Click Edit to add your delivery address.
          </p>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-2">
            Additional details (optional)
          </p>

          <div className="grid grid-cols-1 gap-3">
            <input
              type="text"
              value={address.floor || ''}
              onChange={(e) => updateAddress('floor', e.target.value)}
              placeholder="Floor / Unit / Building"
              className="w-full px-4 py-2 border rounded-xl text-sm focus:border-[#2d6a4f] focus:outline-none"
            />

            <input
              type="text"
              value={address.note || ''}
              onChange={(e) => updateAddress('note', e.target.value)}
              placeholder="Note to rider (ex: Gate code, landmark)"
              className="w-full px-4 py-2 border rounded-xl text-sm focus:border-[#2d6a4f] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <DeliveryOptions
        deliveryOption={deliveryOption}
        onOptionChange={handleDeliveryOptionChange}
        scheduleDisplay={getScheduleDisplay()}
        onScheduleClick={() => setShowSchedule(true)}
      />

      <PaymentMethods
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
      />

      <ScheduleModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        availableDates={availableDates}
        timeSlots={timeSlots}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
        onConfirm={() => {
          if (confirmSchedule()) {
            setShowSchedule(false);
          }
        }}
      />

      {showLocationPicker && (
        <LocationPicker
          initialLat={14.329}
          initialLng={120.936}
          onSelectLocation={handleLocationSelect}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  );
};

export default CheckoutForm;