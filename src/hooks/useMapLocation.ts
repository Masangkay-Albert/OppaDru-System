// src/hooks/useMapLocation.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { getAddressFromCoords, getPositionKey } from '../services/geocodingService';
import type { ResolvedAddress } from '../services/geocodingService';
import type { LocationResult } from './useLocationSearch';

export const useMapLocation = (initialLat: number, initialLng: number) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [currentAddress, setCurrentAddress] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [resolvedPositionKey, setResolvedPositionKey] = useState('');
  const [selectedSearchResult, setSelectedSearchResult] = useState<LocationResult | null>(null);
  
  const reverseRequestIdRef = useRef(0);

  const resolveAndStorePinAddress = useCallback(
    async (lat: number, lng: number) => {
      const requestId = reverseRequestIdRef.current + 1;
      reverseRequestIdRef.current = requestId;

      const result = await getAddressFromCoords(lat, lng);

      if (requestId !== reverseRequestIdRef.current) {
        return null;
      }

      if (result) {
        setCurrentAddress(result.address);
        setCurrentName(result.name);
        setResolvedPositionKey(getPositionKey(lat, lng));
      } else {
        setCurrentAddress('');
        setCurrentName('');
        setResolvedPositionKey('');
      }

      return result;
    },
    []
  );

  const updatePosition = useCallback((lat: number, lng: number) => {
    setPosition([lat, lng]);
    setSelectedSearchResult(null);
    resolveAndStorePinAddress(lat, lng);
  }, [resolveAndStorePinAddress]);

  const selectSearchResult = useCallback((result: LocationResult) => {
    setSelectedSearchResult(result);
    setPosition([result.lat, result.lng]);
    setCurrentAddress(result.address);
    setCurrentName(result.name);
    setResolvedPositionKey(getPositionKey(result.lat, result.lng));
    return result;
  }, []);

  const clearSelectedSearch = useCallback(() => {
    setSelectedSearchResult(null);
  }, []);

  useEffect(() => {
    resolveAndStorePinAddress(initialLat, initialLng);
  }, [initialLat, initialLng, resolveAndStorePinAddress]);

  return {
    position,
    currentAddress,
    currentName,
    resolvedPositionKey,
    selectedSearchResult,
    updatePosition,
    selectSearchResult,
    clearSelectedSearch,
    resolveAndStorePinAddress
  };
};