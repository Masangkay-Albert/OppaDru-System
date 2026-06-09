// src/services/geocodingService.ts
import { OPPA_DRU_STORE } from '../utils/constants';

export interface ResolvedAddress {
  name: string;
  address: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// Re-export from constants para iisa lang ang source of truth
export const OPPA_DRU_STORE_COORDS = { 
  lat: OPPA_DRU_STORE.lat, 
  lng: OPPA_DRU_STORE.lng 
};

export const getAddressName = (address: string) => {
  return address.split(',')[0]?.trim() || address;
};

export const getPositionKey = (lat: number, lng: number) => {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
};

// Get REAL address from ANY coordinates (walang limitasyon)
export const getAddressFromCoords = async (
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data = await response.json();

    if (data?.display_name) {
      let cleanAddress = data.display_name;
      cleanAddress = cleanAddress.replace(', Philippines', '');
      const shortName = cleanAddress.split(',')[0];
      
      return {
        name: shortName,
        address: cleanAddress
      };
    }

    return null;
  } catch {
    return null;
  }
};

// Geocode ANY address sa Pilipinas (walang limitasyon)
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address.trim()) return null;
  
  try {
    // Search with the exact address, no forced location
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    
    // If not found, try adding "Philippines"
    const response2 = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}, Philippines&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data2 = await response2.json();
    
    if (data2 && data2.length > 0) {
      return {
        lat: parseFloat(data2[0].lat),
        lng: parseFloat(data2[0].lon)
      };
    }
    
    return null;
  } catch {
    return null;
  }
};

export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateETA = (distanceKm: number, speedKmPerHour: number = 30): number => {
  return Math.max(1, Math.round((distanceKm / speedKmPerHour) * 60));
};

export const interpolatePosition = (
  start: Coordinates,
  end: Coordinates,
  progress: number
): Coordinates => {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress
  };
};

export const getRoutePoints = (start: Coordinates, end: Coordinates): Coordinates[] => {
  const points: Coordinates[] = [start];
  const steps = 30;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t
    });
  }
  
  points.push(end);
  return points;
};