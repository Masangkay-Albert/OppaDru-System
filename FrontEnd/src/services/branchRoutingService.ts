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
  franchise_account_id?: string | null;
  name?: string;
  customer_coordinates: { lat: number; lng: number };
  distance_km: number;
  notice?: string | null;
  unavailable_items: string[];
  pricing: { deliveryFee: number; deliveryDistanceKm: number; total: number };
}

export class BranchResolutionError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'BranchResolutionError';
    this.code = code;
    this.status = status;
  }
}

export const resolveBranch = async (data: {
  address: string;
  coordinates?: { lat: number; lng: number };
  items: Array<{ product_id: string; quantity: number; selected_addons?: Array<{ id: string }> }>;
  delivery_type: string;
  voucher_discount?: number;
  discount_rate?: number;
  fulfillment_type?: 'delivery' | 'pickup';
  franchise_id?: string | null;
}, signal?: AbortSignal): Promise<BranchResolution> => {
  const response = await fetch(`${API_URL}/branches/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = payload.errors
      ? Object.values(payload.errors as Record<string, string[]>).flat().join(' ')
      : '';
    throw new BranchResolutionError(
      validationMessage || payload.message || 'Sorry, we do not deliver to this address yet.',
      typeof payload.code === 'string' ? payload.code : undefined,
      response.status,
    );
  }
  return payload.data as BranchResolution;
};
