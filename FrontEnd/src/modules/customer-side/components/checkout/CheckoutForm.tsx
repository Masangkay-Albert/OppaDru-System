import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/Authcontext';
import { useSettings } from '../../../../contexts/SettingsContext';
import { useAddressManagement } from '../../../../hooks/useAddressManagement';
import LocationPicker from '../common/LocationPicker';
import AddressSection from './AddressSection';
import PersonalDetailsForm from './PersonalDetailsForm';
import DeliveryOptions from './DeliveryOptions';
import PaymentMethods from './PaymentMethods';

interface AddressFormState {
  street: string;
  floor: string;
  note: string;
  block: string;
  lot: string;
}

interface CheckoutFormProps {
  address: AddressFormState;
  updateAddress: (field: keyof AddressFormState, value: string) => void;
  tempPerson: { fullName: string; email: string; phone: string };
  updatePerson: (field: keyof { fullName: string; email: string; phone: string }, value: string) => void;
  deliveryType: 'standard' | 'priority';
  setDeliveryType: (type: 'standard' | 'priority') => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  scheduleDisplay: string;
  onScheduleClick: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  updateAddress,
  tempPerson,
  updatePerson,
  deliveryType,
  setDeliveryType,
  paymentMethod,
  setPaymentMethod,
  scheduleDisplay,
  onScheduleClick
}) => {
  const { user } = useAuth();
  const { getActiveDiscount } = useSettings();
  const activeDiscount = getActiveDiscount();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const {
    savedAddresses,
    selectedAddressId,
    selectedAddressDetails,
    editingAddress,
    setEditingAddress,
    addAddress,
    deleteAddress,
    selectAddress,
    setDefaultAddress,
    updateDetails,
  } = useAddressManagement({
    userId: user?.id,
    onAddressSelect: (street, details) => {
      if (street) {
        updateAddress('street', street);
      }
      if (details?.floor) updateAddress('floor', details.floor);
      if (details?.note) updateAddress('note', details.note);
      updateAddress('block', details?.block || '');
      updateAddress('lot', details?.lot || '');
    }
  });

  const handleAddressSelect = (location: { lat: number; lng: number; address: string; name: string }) => {
    const newAddress = addAddress(location);
    if (newAddress) {
      setShowLocationPicker(false);
    }
  };

  const handleDeleteAddress = (id: string) => {
    deleteAddress(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultAddress(id);
  };

  const handleSaveDetails = (details: any) => {
    if (selectedAddressId) {
      updateDetails(selectedAddressId, details);
      if (details.floor) updateAddress('floor', details.floor);
      if (details.note) updateAddress('note', details.note);
      updateAddress('block', details.block || '');
      updateAddress('lot', details.lot || '');
    }
  };

  const handleDeliveryOptionChange = (option: 'standard' | 'priority' | 'scheduled') => {
    if (option === 'scheduled') {
      onScheduleClick();
    } else {
      setDeliveryType(option);
    }
  };

  return (
    <div className="space-y-6">
      <PersonalDetailsForm tempPerson={tempPerson} onUpdatePerson={updatePerson} />

      <AddressSection
        addresses={savedAddresses}
        selectedId={selectedAddressId}
        selectedDetails={selectedAddressDetails}
        onSelect={selectAddress}
        onEdit={(addr) => { setEditingAddress(addr); setShowLocationPicker(true); }}
        onDelete={handleDeleteAddress}
        onSetDefault={handleSetDefault}
        onAddNew={() => { setEditingAddress(null); setShowLocationPicker(true); }}
        onSaveDetails={handleSaveDetails}
      />

      <DeliveryOptions
        deliveryOption={deliveryType}
        onOptionChange={handleDeliveryOptionChange}
        scheduleDisplay={scheduleDisplay}
        onScheduleClick={onScheduleClick}
      />

      <PaymentMethods paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />

      {showLocationPicker && (
        <LocationPicker
          onSelectLocation={handleAddressSelect}
          onClose={() => {
            setShowLocationPicker(false);
            setEditingAddress(null);
          }}
          initialLat={editingAddress?.lat || 14.329}
          initialLng={editingAddress?.lng || 120.936}
          initialAddress={editingAddress?.address || ''}
        />
      )}
    </div>
  );
};

export default CheckoutForm;