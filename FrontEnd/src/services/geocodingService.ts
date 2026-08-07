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

export const searchAddresses = async (query: string): Promise<Array<{
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
}>> => {
  if (!query.trim()) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=15&addressdetails=1&countrycodes=PH&dedupe=1&polygon=0&accept-language=en`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
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

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  if (!address.trim()) return null;

  try {
    const searchQuery = address.includes('Philippines') || address.includes('PH')
      ? address
      : `${address}, Philippines`;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=ph`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data = await response.json();

    if (!data?.length) {
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'OppaDruFoodDelivery/1.0'
          }
        }
      );
      const fallbackData = await fallbackResponse.json();
      if (!fallbackData?.length) return null;

      return {
        lat: parseFloat(fallbackData[0].lat),
        lng: parseFloat(fallbackData[0].lon)
      };
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    };
  } catch (error) {
    console.error('Geocode address error:', error);
    return null;
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
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