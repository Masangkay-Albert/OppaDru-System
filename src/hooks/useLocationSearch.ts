// src/hooks/useLocationSearch.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export interface LocationResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  displayName?: string;
  importance?: number;
}

interface OSMResponse {
  display_name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
  importance: number;
  address: {
    [key: string]: string;
  };
}

export const searchLocationAPI = async (query: string): Promise<LocationResult[]> => {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQuery
    )}&limit=15&addressdetails=1&accept-language=en&countrycodes=ph&dedupe=1&polygon=0`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OppaDruFoodDelivery/1.0'
      }
    });

    const data: OSMResponse[] = await response.json();
    if (!Array.isArray(data)) return [];

    const prioritized = data
      .filter((item) => item?.display_name && item?.lat && item?.lon)
      .sort((a, b) => {
        const aHasPH = a.display_name?.toLowerCase().includes('philippines');
        const bHasPH = b.display_name?.toLowerCase().includes('philippines');
        if (aHasPH && !bHasPH) return -1;
        if (!aHasPH && bHasPH) return 1;
        return (b.importance || 0) - (a.importance || 0);
      });

    return prioritized.map((item) => ({
      name: item.display_name.split(',')[0]?.trim() || item.display_name,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.class || 'location',
      displayName: item.display_name,
      importance: item.importance
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
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