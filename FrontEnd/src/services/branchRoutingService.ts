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

const recentResolutions = new Map<string, { resolvedAt: number; result: BranchResolution }>();
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
  const cached = recentResolutions.get(key);
  if (cached && Date.now() - cached.resolvedAt < 10000) return cached.result;

  let request = pendingResolutions.get(key);
  if (!request) {
    request = (async () => {
      try {
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
          throw new BranchResolutionError(
            validationMessage || payload.message || 'Sorry, we do not deliver to this address yet.',
            typeof payload.code === 'string' ? payload.code : undefined,
            response.status,
          );
        }
        const result = payload.data as BranchResolution;
        recentResolutions.set(key, { resolvedAt: Date.now(), result });
        if (recentResolutions.size > 100) {
          const oldestKey = recentResolutions.keys().next().value;
          if (oldestKey) recentResolutions.delete(oldestKey);
        }
        return result;
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
