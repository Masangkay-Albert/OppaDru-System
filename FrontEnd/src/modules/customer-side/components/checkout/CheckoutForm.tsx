import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/Authcontext';
import { useAddressManagement, type AddressDetails } from '../../../../hooks/useAddressManagement';
import type { CartItem } from '../../../../types/product.types';
import { BranchResolutionError, resolveBranch } from '../../../../services/branchRoutingService';
import LocationPicker from '../common/LocationPicker';
import { useToast } from '../ToastProvider';
import AddressSection from './AddressSection';
import PersonalDetailsForm from './PersonalDetailsForm';
import DeliveryOptions from './DeliveryOptions';
import PaymentMethods from './PaymentMethods';

const PHILIPPINES_CENTER = { lat: 12.8797, lng: 121.774 };
type AddressAvailability = 'checking' | 'deliverable' | 'out-of-range' | 'different-branch' | 'unknown';

interface AddressEvaluation {
  status: AddressAvailability;
  distanceKm?: number;
}

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
  cartItems: CartItem[];
  activeBranchId: string | null;
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
  onAddressCoordinatesChange?: (coordinates: { lat: number; lng: number } | null) => void;
  onStreetDetailChange?: (street: string) => void;
  onDeliveryInstructionsChange?: (details: AddressDetails) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  cartItems,
  activeBranchId,
  updateAddress,
  tempPerson,
  updatePerson,
  deliveryType,
  setDeliveryType,
  paymentMethod,
  setPaymentMethod,
  scheduleDisplay,
  onScheduleClick,
  onAddressCoordinatesChange,
  onStreetDetailChange,
  onDeliveryInstructionsChange,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [addressEvaluationResult, setAddressEvaluationResult] = useState<{
    key: string;
    addresses: Record<string, AddressEvaluation>;
  }>({ key: '', addresses: {} });
  const autoSelectAttemptRef = useRef('');

  const handleSavedAddressSelect = useCallback((street: string, details?: AddressDetails, coordinates?: { lat: number; lng: number }) => {
    const hasValidCoordinates = Boolean(
      coordinates
      && Number.isFinite(coordinates.lat)
      && Number.isFinite(coordinates.lng)
      && !(coordinates.lat === 0 && coordinates.lng === 0)
    );
    onAddressCoordinatesChange?.(hasValidCoordinates ? { lat: coordinates!.lat, lng: coordinates!.lng } : null);
    onStreetDetailChange?.(details?.street || '');
    if (street) updateAddress('street', street);
    updateAddress('floor', details?.floor || '');
    updateAddress('note', details?.note || '');
    updateAddress('block', details?.block || '');
    updateAddress('lot', details?.lot || '');
    updateAddress('unit', details?.unit || '');
    updateAddress('building', details?.building || '');
    onDeliveryInstructionsChange?.(details || {});
  }, [onAddressCoordinatesChange, onDeliveryInstructionsChange, onStreetDetailChange, updateAddress]);

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
    onAddressSelect: handleSavedAddressSelect,
  });

  const routeItems = useMemo(() => cartItems.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
    selected_addons: (item.selectedAddons || []).map((addon) => ({ id: addon.id })),
  })), [cartItems]);
  const routeItemsKey = JSON.stringify(routeItems);
  const currentEvaluationKey = `${activeBranchId || ''}:${routeItemsKey}:${savedAddresses.map((address) => `${address.id}:${address.address}:${address.lat || ''}:${address.lng || ''}`).join('|')}`;
  const addressEvaluations = useMemo(
    () => addressEvaluationResult.key === currentEvaluationKey ? addressEvaluationResult.addresses : {},
    [addressEvaluationResult, currentEvaluationKey],
  );
  const addressAvailability = Object.fromEntries(savedAddresses.map((savedAddress) => [
    savedAddress.id,
    addressEvaluations[savedAddress.id]?.status || (activeBranchId ? 'checking' : 'unknown'),
  ]));
  const mixedCartBranches = new Set(cartItems.map((item) => item.franchise_id).filter(Boolean)).size > 1;

  useEffect(() => {
    if (!activeBranchId || savedAddresses.length === 0 || cartItems.length === 0) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    if (mixedCartBranches) {
      void Promise.resolve().then(() => {
        if (active) {
          setAddressEvaluationResult({
            key: currentEvaluationKey,
            addresses: Object.fromEntries(savedAddresses.map((address) => [address.id, { status: 'different-branch' as const }])),
          });
        }
      });
      return () => { active = false; controller.abort(); };
    }

    void Promise.all(savedAddresses.map(async (savedAddress): Promise<[string, AddressEvaluation]> => {
      try {
        const result = await resolveBranch({
          address: savedAddress.address,
          ...(Number.isFinite(savedAddress.lat) && Number.isFinite(savedAddress.lng)
            ? { coordinates: { lat: Number(savedAddress.lat), lng: Number(savedAddress.lng) } }
            : {}),
          items: routeItems,
          delivery_type: 'standard',
          fulfillment_type: 'delivery',
        }, controller.signal);
        return [savedAddress.id, {
          status: result.branch.id === activeBranchId ? 'deliverable' : 'different-branch',
          distanceKm: result.distance_km,
        }];
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return [savedAddress.id, { status: 'checking' }];
        }
        return [savedAddress.id, {
          status: error instanceof BranchResolutionError && error.code === 'OUT_OF_RANGE'
            ? 'out-of-range'
            : error instanceof BranchResolutionError && error.code === 'BRANCH_MISMATCH'
              ? 'different-branch'
              : 'unknown',
          distanceKm: error instanceof BranchResolutionError ? error.details?.distanceKm : undefined,
        }];
      }
    })).then((entries) => {
      if (!active) return;
      setAddressEvaluationResult({ key: currentEvaluationKey, addresses: Object.fromEntries(entries) });
    });

    return () => { active = false; controller.abort(); };
  }, [activeBranchId, cartItems.length, currentEvaluationKey, mixedCartBranches, routeItems, savedAddresses]);

  useEffect(() => {
    if (!selectedAddressId || addressEvaluationResult.key !== currentEvaluationKey) return;
    if (addressEvaluations[selectedAddressId]?.status === 'deliverable') return;
    const nearestDeliverable = savedAddresses
      .filter((savedAddress) => addressEvaluations[savedAddress.id]?.status === 'deliverable')
      .sort((left, right) => (addressEvaluations[left.id]?.distanceKm ?? Infinity) - (addressEvaluations[right.id]?.distanceKm ?? Infinity))[0];
    if (!nearestDeliverable) return;
    const attemptKey = `${currentEvaluationKey}:${selectedAddressId}`;
    if (autoSelectAttemptRef.current === attemptKey) return;
    autoSelectAttemptRef.current = attemptKey;
    selectAddress(nearestDeliverable.id);
    showToast(`We switched to ${nearestDeliverable.name} because it's within range.`, 'info');
  }, [addressEvaluationResult.key, addressEvaluations, currentEvaluationKey, savedAddresses, selectAddress, selectedAddressId, showToast]);

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
        addressAvailability={addressAvailability}
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
          initialLat={editingAddress?.lat || PHILIPPINES_CENTER.lat}
          initialLng={editingAddress?.lng || PHILIPPINES_CENTER.lng}
          initialAddress={editingAddress?.address || ''}
        />
      )}
    </div>
  );
};

export default CheckoutForm;
