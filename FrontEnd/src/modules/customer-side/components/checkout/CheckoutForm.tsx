import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/Authcontext';
import { useAddressManagement, type AddressDetails } from '../../../../hooks/useAddressManagement';
import LocationPicker from '../common/LocationPicker';
import AddressSection from './AddressSection';
import PersonalDetailsForm from './PersonalDetailsForm';
import DeliveryOptions from './DeliveryOptions';
import PaymentMethods from './PaymentMethods';

const PHILIPPINES_CENTER = { lat: 12.8797, lng: 121.774 };

interface AddressFormState {
  street: string;
  floor: string;
  note: string;
  block: string;
  lot: string;
  unit: string;
  building: string;
}

interface CheckoutFormProps {
  address: AddressFormState;
  updateAddress: (field: keyof AddressFormState, value: string) => void;
  tempPerson: { fullName: string; email: string; phone: string };
  updatePerson: (field: keyof { fullName: string; email: string; phone: string }, value: string) => void;
  deliveryType: 'standard' | 'priority' | 'scheduled';
  setDeliveryType: (type: 'standard' | 'priority' | 'scheduled') => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  scheduleDisplay: string;
  onScheduleClick: () => void;
  discountType?: 'PWD' | 'Senior Citizen' | null;
  discountProof?: File | null;
  onDiscountProofChange?: (file: File | null) => void;
  onAddressCoordinatesChange?: (coordinates: { lat: number; lng: number } | null) => void;
  onStreetDetailChange?: (street: string) => void;
  onDeliveryInstructionsChange?: (details: AddressDetails) => void;
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
  onScheduleClick,
  discountType,
  discountProof,
  onDiscountProofChange,
  onAddressCoordinatesChange,
  onStreetDetailChange,
  onDeliveryInstructionsChange,
}) => {
  const { user } = useAuth();
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
    onAddressSelect: (street, details, coordinates) => {
      const hasValidCoordinates = Boolean(
        coordinates
        && Number.isFinite(coordinates.lat)
        && Number.isFinite(coordinates.lng)
        && !(coordinates.lat === 0 && coordinates.lng === 0)
      );
      onAddressCoordinatesChange?.(hasValidCoordinates ? { lat: coordinates!.lat, lng: coordinates!.lng } : null);
      onStreetDetailChange?.(details?.street || '');
      if (street) {
        updateAddress('street', street);
      }
      updateAddress('floor', details?.floor || '');
      updateAddress('note', details?.note || '');
      updateAddress('block', details?.block || '');
      updateAddress('lot', details?.lot || '');
      updateAddress('unit', details?.unit || '');
      updateAddress('building', details?.building || '');
      onDeliveryInstructionsChange?.(details || {});
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

  const handleSaveDetails = (details: AddressDetails) => {
    if (selectedAddressId) {
      updateDetails(selectedAddressId, details);
      onStreetDetailChange?.(details.street || '');
      updateAddress('floor', details.floor || '');
      updateAddress('note', details.note || '');
      updateAddress('block', details.block || '');
      updateAddress('lot', details.lot || '');
      updateAddress('unit', details.unit || '');
      updateAddress('building', details.building || '');
      onDeliveryInstructionsChange?.(details);
    }
  };

  const handleDeliveryOptionChange = (option: 'standard' | 'priority' | 'scheduled') => {
    if (option === 'scheduled') {
      setDeliveryType('scheduled');
      onScheduleClick();
      return;
    }

    setDeliveryType(option);
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

      {discountType && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">Discount verification</p>
              <p className="text-xs text-amber-700">{discountType} discount request is pending admin review.</p>
            </div>
          </div>

          <label className="block w-full">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-amber-800">Upload valid ID / proof</span>
            <input
              type="file"
              accept="image/*"
              className="block w-full cursor-pointer rounded-xl border border-dashed border-amber-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
              onChange={(event) => onDiscountProofChange?.(event.target.files?.[0] || null)}
            />
          </label>

          {discountProof && (
            <p className="mt-2 text-xs text-amber-800">Selected file: {discountProof.name}</p>
          )}
        </div>
      )}

      {showLocationPicker && (
        <LocationPicker
          onSelectLocation={handleAddressSelect}
          onClose={() => {
            setShowLocationPicker(false);
            setEditingAddress(null);
          }}
          initialLat={editingAddress?.lat || PHILIPPINES_CENTER.lat}
          initialLng={editingAddress?.lng || PHILIPPINES_CENTER.lng}
          initialAddress={editingAddress?.address || ''}
        />
      )}
    </div>
  );
};

export default CheckoutForm;
