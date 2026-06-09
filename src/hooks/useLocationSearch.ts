import { useState, useEffect, useRef, useCallback } from 'react';

export interface LocationResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const searchLocationAPI = async (query: string): Promise<LocationResult[]> => {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      cleanQuery
    )}&limit=5&addressdetails=1&accept-language=en`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OppaDruFoodDelivery/1.0'
      }
    });

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => item?.display_name && item?.lat && item?.lon)
      .map((item: any) => ({
        name: item.display_name.split(',')[0].trim(),
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
  } catch {
    return [];
  }
};

export const useLocationSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);

  const debounceTimer = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
    }

    const cleanQuery = searchQuery.trim();

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (cleanQuery.length <= 2) {
      requestIdRef.current += 1;
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    debounceTimer.current = window.setTimeout(async () => {
      setIsSearching(true);

      const results = await searchLocationAPI(cleanQuery);

      if (requestId === requestIdRef.current) {
        setSearchResults(results);
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  const selectLocation = useCallback((location: LocationResult) => {
    skipNextSearchRef.current = true;
    requestIdRef.current += 1;

    setSelectedLocation(location);
    setSearchQuery(location.address);
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const clearSearch = useCallback(() => {
    requestIdRef.current += 1;

    setSearchQuery('');
    setSearchResults([]);
    setSelectedLocation(null);
    setIsSearching(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    selectedLocation,
    selectLocation,
    clearSearch
  };
};