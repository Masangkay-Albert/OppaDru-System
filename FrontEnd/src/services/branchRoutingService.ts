import { API_URL } from './apiConfig';

export interface RoutedBranch {
  id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  status?: string;
}

export interface BranchResolution {
  branch: RoutedBranch;
  distance_km: number;
  notice?: string | null;
  unavailable_items: string[];
  pricing: { deliveryFee: number; deliveryDistanceKm: number; total: number };
}

export const resolveBranch = async (data: {
  coordinates: { lat: number; lng: number };
  items: Array<{ product_id: string; quantity: number; selected_addons?: Array<{ id: string }> }>;
  delivery_type: string;
  voucher_discount?: number;
  discount_rate?: number;
  fulfillment_type?: 'delivery' | 'pickup';
  franchise_id?: string | null;
}): Promise<BranchResolution> => {
  const response = await fetch(`${API_URL}/branches/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = payload.errors
      ? Object.values(payload.errors as Record<string, string[]>).flat().join(' ')
      : '';
    throw new Error(validationMessage || payload.message || 'Sorry, we do not deliver to this address yet.');
  }
  return payload.data as BranchResolution;
};
