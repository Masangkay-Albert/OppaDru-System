// src/hooks/useLocationSearch.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { searchAddresses } from '../services/geocodingService';

export interface LocationResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  displayName?: string;
  importance?: number;
}

export const searchLocationAPI = async (query: string): Promise<LocationResult[]> => {
  const results = await searchAddresses(query);
  return results.map((item) => ({
    ...item,
    displayName: item.address,
  }));
};

export const useLocationSearch = (debounceDelay: number = 300) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setError(null);

    const q = searchQuery.trim();

    if (q.length <= 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    debounceRef.current = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const results = await searchLocationAPI(q);

        if (requestId === requestIdRef.current) {
          setSearchResults(results);
          
          if (results.length === 0) {
            setError('No locations found. Try a different search term.');
          }
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setError('Failed to search locations. Please try again.');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, debounceDelay);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [searchQuery, debounceDelay]);

  const selectLocation = useCallback((location: LocationResult | null) => {
    setSelectedLocation(location);
    if (location) {
      setSearchQuery(location.address);
    }
    setSearchResults([]);
    setIsSearching(false);
    setError(null);
  }, []);

  const clearSearch = useCallback(() => {
    requestIdRef.current++;
    setSearchQuery('');
    setSearchResults([]);
    setSelectedLocation(null);
    setIsSearching(false);
    setError(null);
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (selectedLocation) {
      setSelectedLocation(null);
    }
  }, [selectedLocation]);

  return {
    searchQuery,
    setSearchQuery: handleInputChange,
    searchResults,
    isSearching,
    selectedLocation,
    selectLocation,
    clearSearch,
    error
  };
};