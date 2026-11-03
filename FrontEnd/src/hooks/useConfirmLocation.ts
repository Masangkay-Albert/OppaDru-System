// src/modules/customer-side/components/common/hooks/useConfirmLocation.ts

import { useCallback } from 'react';
import { searchLocationAPI } from './useLocationSearch';
import type { LocationResult } from './useLocationSearch';
import { getAddressFromCoords } from '../services/geocodingService';
import { cleanAddress, getShortName } from '../utils/locationUtils';
import { useToast } from '../modules/customer-side/components/ToastProvider';

interface Params {
  searchQuery: string;
  selectedSearchResult: LocationResult | null;
  position: [number, number];
  onSelectLocation: (location: {
    lat: number;
    lng: number;
    name: string;
    address: string;
  }) => void;
  onClose: () => void;
}

export const useConfirmLocation = ({
  searchQuery,
  selectedSearchResult,
  position,
  onSelectLocation,
  onClose
}: Params) => {
  const { showToast } = useToast();
  return useCallback(async () => {
    const typed = searchQuery.trim();

    let finalResult: LocationResult | null = selectedSearchResult;

    if (typed && (!finalResult || finalResult.address !== typed)) {
      const results = await searchLocationAPI(typed);
      finalResult = results[0] || null;
    }

    if (!typed) {
      const pin = await getAddressFromCoords(position[0], position[1]);

      if (!pin) {
        showToast('Unable to resolve location. Try adjusting the pin.', 'error');
        return;
      }

      onSelectLocation({
        lat: position[0],
        lng: position[1],
        name: getShortName(pin.address),
        address: cleanAddress(pin.address)
      });

      onClose();
      return;
    }

    if (finalResult) {
      onSelectLocation({
        lat: finalResult.lat,
        lng: finalResult.lng,
        name: getShortName(finalResult.address),
        address: cleanAddress(finalResult.address)
      });
    } else {
      onSelectLocation({
        lat: position[0],
        lng: position[1],
        name: getShortName(typed),
        address: cleanAddress(typed)
      });
    }

    onClose();
  }, [searchQuery, selectedSearchResult, position, onSelectLocation, onClose, showToast]);
};