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

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address.trim()) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=10&countrycodes=ph`
    );
    const data = await response.json();

    if (!data?.length) return null;

    const searchTerms = address.toLowerCase().split(' ');
    const selectedResult = data.find((result: any) => {
      const display = (result.display_name || '').toLowerCase();
      return searchTerms.some((term: string) => display.includes(term));
    }) || data[0];

    return {
      lat: parseFloat(selectedResult.lat),
      lng: parseFloat(selectedResult.lon)
    };
  } catch {
    return null;
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    const data = await response.json();

    if (data?.display_name) {
      return data.display_name;
    }
    return null;
  } catch {
    return null;
  }
};

export const getRouteFromGoogle = async (
  start: Coordinates,
  end: Coordinates
): Promise<[number, number][] | null> => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const response = await fetch(
      `/google-maps/directions/json?origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.routes.length > 0) {
      const points = data.routes[0].overview_polyline.points;
      return decodePolyline(points);
    }
    return null;
  } catch {
    return null;
  }
};

const decodePolyline = (encoded: string): [number, number][] => {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
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
  const address = await reverseGeocode(lat, lng);
  if (!address) return null;
  
  return {
    name: getAddressName(address),
    address
  };
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

export const getPositionAlongRoute = (
  routePoints: [number, number][], 
  progressPercent: number
): Coordinates => {
  if (routePoints.length === 0) {
    return { lat: 0, lng: 0 };
  }
  if (progressPercent >= 100) {
    const lastPoint = routePoints[routePoints.length - 1];
    return { lat: lastPoint[0], lng: lastPoint[1] };
  }
  if (progressPercent <= 0) {
    const firstPoint = routePoints[0];
    return { lat: firstPoint[0], lng: firstPoint[1] };
  }

  const targetIndex = (progressPercent / 100) * (routePoints.length - 1);
  const index = Math.floor(targetIndex);
  const nextIndex = Math.min(index + 1, routePoints.length - 1);
  const fraction = targetIndex - index;
  const currentPoint = routePoints[index];
  const nextPoint = routePoints[nextIndex];
  
  return {
    lat: currentPoint[0] + (nextPoint[0] - currentPoint[0]) * fraction,
    lng: currentPoint[1] + (nextPoint[1] - currentPoint[1]) * fraction
  };
};