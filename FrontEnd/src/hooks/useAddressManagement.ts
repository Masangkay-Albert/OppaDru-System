// src/hooks/useAddressManagement.ts
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface AddressDetails {
  block?: string;
  lot?: string;
  floor?: string;
  unit?: string;
  building?: string;
  note?: string;
}

export interface SavedAddress {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
  label?: string;
  details?: AddressDetails;
  needsPin?: boolean;
}

interface UseAddressManagementProps {
  userId?: string;
  onAddressSelect?: (address: string, details?: AddressDetails, coordinates?: { lat: number; lng: number }) => void;
}

const STORAGE_KEY = 'oppa_dru_addresses';
const STORAGE_VERSION = 2;
const PHILIPPINES_BOUNDS = { minLat: 4, maxLat: 22, minLng: 116, maxLng: 127 };

const getCoordinates = (address: SavedAddress): { lat: number; lng: number } | undefined => {
  if (!Number.isFinite(address.lat) || !Number.isFinite(address.lng)) return undefined;
  if (address.lat === 0 && address.lng === 0) return undefined;
  if (address.lat! < PHILIPPINES_BOUNDS.minLat || address.lat! > PHILIPPINES_BOUNDS.maxLat || address.lng! < PHILIPPINES_BOUNDS.minLng || address.lng! > PHILIPPINES_BOUNDS.maxLng) return undefined;
  return { lat: Number(address.lat), lng: Number(address.lng) };
};

const normalizeSavedAddress = (address: SavedAddress): SavedAddress => {
  const coordinates = address.needsPin ? undefined : getCoordinates(address);
  return {
    ...address,
    needsPin: address.needsPin === true || !coordinates,
    ...(coordinates || { lat: undefined, lng: undefined }),
  };
};

export const useAddressManagement = ({ userId, onAddressSelect }: UseAddressManagementProps = {}) => {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [selectedAddressDetails, setSelectedAddressDetails] = useState<AddressDetails>({});
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Load addresses from localStorage
  useEffect(() => {
    const key = `${STORAGE_KEY}_${userId || 'guest'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map(normalizeSavedAddress);
          setSavedAddresses(normalized);
          localStorage.setItem(`${key}_version`, String(STORAGE_VERSION));
          const defaultAddr = normalized.find((addr: SavedAddress) => addr.isDefault);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setSelectedAddressDetails(defaultAddr.details || {});
            if (onAddressSelect) {
              onAddressSelect(defaultAddr.address, defaultAddr.details, getCoordinates(defaultAddr));
            }
          } else {
            setSelectedAddressId(normalized[0].id);
            setSelectedAddressDetails(normalized[0].details || {});
            if (onAddressSelect) {
              onAddressSelect(normalized[0].address, normalized[0].details, getCoordinates(normalized[0]));
            }
          }
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
        setSavedAddresses([]);
      }
    }
  }, [userId]);

  // Save addresses to localStorage whenever they change
  useEffect(() => {
    const key = `${STORAGE_KEY}_${userId || 'guest'}`;
    if (savedAddresses.length > 0) {
      localStorage.setItem(key, JSON.stringify(savedAddresses));
    } else {
      localStorage.removeItem(key);
    }
  }, [savedAddresses, userId]);

  const addAddress = useCallback((location: { lat: number; lng: number; address: string; name: string }) => {
    const newAddress: SavedAddress = {
      id: uuidv4(),
      name: location.name || 'My Location',
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      isDefault: savedAddresses.length === 0,
      details: editingAddress?.details || {}
    };

    let updatedAddresses: SavedAddress[];

    if (editingAddress) {
      updatedAddresses = savedAddresses.map(addr => 
        addr.id === editingAddress.id ? { ...addr, ...newAddress } : addr
      );
      setSavedAddresses(updatedAddresses);
      setSelectedAddressId(newAddress.id);
      setSelectedAddressDetails(newAddress.details || {});
      onAddressSelect?.(newAddress.address, newAddress.details, getCoordinates(newAddress));
      setEditingAddress(null);
    } else {
      updatedAddresses = [...savedAddresses, newAddress];
      setSavedAddresses(updatedAddresses);
      setSelectedAddressId(newAddress.id);
      setSelectedAddressDetails(newAddress.details || {});
      if (onAddressSelect) {
        onAddressSelect(newAddress.address, newAddress.details, getCoordinates(newAddress));
      }
    }
    
    return newAddress;
  }, [editingAddress, savedAddresses, onAddressSelect]);

  const deleteAddress = useCallback((id: string) => {
    const addressToDelete = savedAddresses.find(a => a.id === id);
    if (!addressToDelete) return false;

    const updatedAddresses = savedAddresses.filter(a => a.id !== id);
    setSavedAddresses(updatedAddresses);

    if (selectedAddressId === id) {
      if (updatedAddresses.length > 0) {
        const newSelected = updatedAddresses[0];
        setSelectedAddressId(newSelected.id);
        setSelectedAddressDetails(newSelected.details || {});
        if (onAddressSelect) {
          onAddressSelect(newSelected.address, newSelected.details, getCoordinates(newSelected));
        }
      } else {
        setSelectedAddressId('');
        setSelectedAddressDetails({});
        if (onAddressSelect) {
          onAddressSelect('', {});
        }
      }
    }

    return true;
  }, [savedAddresses, selectedAddressId, onAddressSelect]);

  const selectAddress = useCallback((id: string) => {
    setSelectedAddressId(id);
    const addr = savedAddresses.find(a => a.id === id);
    if (addr) {
      setSelectedAddressDetails(addr.details || {});
      if (onAddressSelect) {
        onAddressSelect(addr.address, addr.details, getCoordinates(addr));
      }
    }
  }, [savedAddresses, onAddressSelect]);

  const setDefaultAddress = useCallback((id: string) => {
    setSavedAddresses(prev => prev.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    })));
    setSelectedAddressId(id);
  }, []);

  const updateDetails = useCallback((id: string, details: AddressDetails) => {
    setSavedAddresses(prev => prev.map(addr =>
      addr.id === id
        ? { ...addr, details: { ...addr.details, ...details } }
        : addr
    ));
    setSelectedAddressDetails(details);
    return details;
  }, []);

  return {
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
  };
};
