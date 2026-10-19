import { API_URL } from './apiConfig';

export interface ResolvedAddress {
  name: string;
  address: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodedCoordinates extends Coordinates {
  matchedQuery: string;
}

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const GEOCODE_CACHE_LIMIT = 200;
let lastNominatimRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();
const geocodeCache = new Map<string, Promise<GeocodedCoordinates | null>>();

const requestNominatim = (endpoint: 'search' | 'reverse', parameters: URLSearchParams): Promise<Response> => {
  const request = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimRequestAt));
    if (waitMs) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    const response = await fetch(`${API_URL}/geo/nominatim/${endpoint}?${parameters.toString()}`, {
      headers: { Accept: 'application/json' },
      referrer: `${window.location.origin}/`,
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    lastNominatimRequestAt = Date.now();
    return response;
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
};

const reportNominatimFailure = (operation: string, response: Response): void => {
  console.error(`${operation} failed with Nominatim status ${response.status} ${response.statusText}.`);
};

export const searchAddresses = async (query: string): Promise<Array<{
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
}>> => {
  if (!query.trim()) return [];

  try {
    const response = await requestNominatim('search', new URLSearchParams({
      q: query,
      limit: '15',
    }));
    if (!response.ok) {
      reportNominatimFailure('Search addresses', response);
      return [];
    }

    const data: NominatimSearchResult[] = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      name: item.display_name.split(',')[0]?.trim() || item.display_name,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.class || 'location'
    }));
  } catch (error) {
    console.error('Search addresses error:', error);
    return [];
  }
};

export const geocodeAddress = async (address: string): Promise<GeocodedCoordinates | null> => {
  const normalizedAddress = address.trim().replace(/\s+/g, ' ');
  if (!normalizedAddress) return null;

  const cacheKey = normalizedAddress.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const lookup = (async (): Promise<GeocodedCoordinates | null> => {
    try {
      const parts = normalizedAddress.split(',').map((part) => part.trim()).filter(Boolean);
      const queries = new Set<string>();
      for (let firstPart = 0; firstPart < parts.length; firstPart += 1) {
        const query = parts.slice(firstPart).join(', ');
        queries.add(query);
        queries.add(query.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      }

      for (const query of queries) {
        const searchQuery = /,\s*philippines$/i.test(query) || /^philippines$/i.test(query)
          ? query
          : `${query}, Philippines`;
        const response = await requestNominatim('search', new URLSearchParams({
          q: searchQuery,
          limit: '1',
        }));
        if (!response.ok) {
          reportNominatimFailure('Geocode address', response);
          return null;
        }

        const data: Array<{ lat?: string; lon?: string }> = await response.json();
        const latitude = Number(data[0]?.lat);
        const longitude = Number(data[0]?.lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { lat: latitude, lng: longitude, matchedQuery: searchQuery };
        }
      }
      return null;
    } catch (error) {
      console.error('Geocode address error:', error);
      return null;
    }
  })();

  geocodeCache.set(cacheKey, lookup);
  if (geocodeCache.size > GEOCODE_CACHE_LIMIT) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey) geocodeCache.delete(oldestKey);
  }
  return lookup;
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await requestNominatim('reverse', new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
    }));
    if (!response.ok) {
      reportNominatimFailure('Reverse geocode', response);
      return null;
    }
    const data = await response.json();

    if (data?.display_name) {
      return data.display_name;
    }
    return null;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
};

export const getRouteOSRM = async (
  start: Coordinates,
  end: Coordinates
): Promise<[number, number][] | null> => {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    );
    const data = await response.json();

    if (data.code === 'Ok' && data.routes?.length > 0) {
     
      const coordinates: [number, number][] = data.routes[0].geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      return coordinates;
    }
    return null;
  } catch (error) {
    console.error('OSRM route fetch error:', error);
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
  } catch (error) {
    console.error('Route fetch error:', error);
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
