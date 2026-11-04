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

export interface BranchResolutionDetails {
  title?: string;
  nearestBranch?: { id?: string; name?: string };
  cartBranch?: { id?: string; name?: string | null };
  servingBranch?: { id?: string; name?: string };
  distanceKm?: number;
}

export class BranchResolutionError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly details?: BranchResolutionDetails;

  constructor(message: string, code?: string, status?: number, details?: BranchResolutionDetails) {
    super(message);
    this.name = 'BranchResolutionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const pendingResolutions = new Map<string, Promise<BranchResolution>>();

const resolutionKey = (data: {
  address: string;
  coordinates?: { lat: number; lng: number };
  items: Array<{ product_id: string; quantity: number; selected_addons?: Array<{ id: string }> }>;
  delivery_type: string;
  voucher_discount?: number;
  discount_rate?: number;
  fulfillment_type?: 'delivery' | 'pickup';
  franchise_id?: string | null;
}) => JSON.stringify({
  // Coordinates are authoritative when present, so address text edits at the same pinned point share one lookup.
  address: data.coordinates ? undefined : data.address.trim().toLowerCase(),
  coordinates: data.coordinates ? { lat: Number(data.coordinates.lat), lng: Number(data.coordinates.lng) } : undefined,
  items: [...data.items].map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    selected_addons: [...(item.selected_addons || [])].map((addon) => addon.id).sort(),
  })).sort((a, b) => a.product_id.localeCompare(b.product_id)),
  delivery_type: data.delivery_type,
  voucher_discount: data.voucher_discount || 0,
  discount_rate: data.discount_rate || 0,
  fulfillment_type: data.fulfillment_type || 'delivery',
  franchise_id: data.franchise_id || null,
});

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
  if (signal?.aborted) throw new DOMException('The request was cancelled.', 'AbortError');
  const key = resolutionKey(data);
  let request = pendingResolutions.get(key);
  if (!request) {
    request = (async () => {
      try {
        const response = await fetch(`${API_URL}/branches/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        const payload: Record<string, unknown> = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errors = payload.errors && typeof payload.errors === 'object'
            ? Object.values(payload.errors as Record<string, unknown>).flatMap((messages) => Array.isArray(messages) ? messages.filter((message): message is string => typeof message === 'string') : [])
            : [];
          const nearest = payload.nearest_branch && typeof payload.nearest_branch === 'object'
            ? payload.nearest_branch as Record<string, unknown>
            : undefined;
          const cartBranch = payload.cart_branch && typeof payload.cart_branch === 'object'
            ? payload.cart_branch as Record<string, unknown>
            : undefined;
          const servingBranch = payload.serving_branch && typeof payload.serving_branch === 'object'
            ? payload.serving_branch as Record<string, unknown>
            : undefined;
          throw new BranchResolutionError(
            errors.join(' ') || (typeof payload.message === 'string' ? payload.message : 'Sorry, we do not deliver to this address yet.'),
            typeof payload.code === 'string' ? payload.code : undefined,
            response.status,
            {
              title: typeof payload.title === 'string' ? payload.title : undefined,
              nearestBranch: nearest ? {
                id: typeof nearest.id === 'string' ? nearest.id : undefined,
                name: typeof nearest.name === 'string' ? nearest.name : undefined,
              } : undefined,
              cartBranch: cartBranch ? {
                id: typeof cartBranch.id === 'string' ? cartBranch.id : undefined,
                name: typeof cartBranch.name === 'string' ? cartBranch.name : null,
              } : undefined,
              servingBranch: servingBranch ? {
                id: typeof servingBranch.id === 'string' ? servingBranch.id : undefined,
                name: typeof servingBranch.name === 'string' ? servingBranch.name : undefined,
              } : undefined,
              distanceKm: typeof payload.distance_km === 'number' ? payload.distance_km : undefined,
            },
          );
        }
        return payload.data as BranchResolution;
      } finally {
        pendingResolutions.delete(key);
      }
    })();
    pendingResolutions.set(key, request);
  }

  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The request was cancelled.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    request!.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
};
