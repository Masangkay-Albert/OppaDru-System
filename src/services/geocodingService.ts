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

export const getAddressFromCoords = async (
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );

    const data = await response.json();

    if (!data?.display_name) return null;

    const address = data.display_name.replace(', Philippines', '');

    return {
      name: getAddressName(address),
      address
    };
  } catch {
    return null;
  }
};

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address.trim()) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );

    const data = await res.json();

    if (data?.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const getRoutePoints = (start: Coordinates, end: Coordinates): Coordinates[] => {
  const points: Coordinates[] = [];
  const steps = 30;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t
    });
  }

  return points;
};