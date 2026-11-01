import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';
import { fetchWithEmployeeAuth } from './employeeAuth';

export interface Promo {
  id: string;
  code?: string;
  title: string;
  description?: string;
  channel?: 'all' | 'online' | 'onsite';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  is_expired?: boolean;
  is_effective_active?: boolean;
  image?: string | null;
  image_url?: string | null;
  applicable_categories?: string[];
  applicable_products?: string[];
  min_order_amount?: number;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  per_customer_limit?: number | null;
  times_used?: number;
  created_at?: string;
}

export interface PromoValidationResult {
  isValid: boolean;
  discount: number;
  code?: string;
  promo?: Promo;
  message?: string;
  errorCode?: string;
  amountRemaining?: number;
}

export interface PromoCartItem {
  id: string;
  quantity: number;
  selected_size?: string;
  selected_addons?: Array<{ id: string; quantity?: number }>;
}

export class PromoRequestError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = 'PromoRequestError';
    this.fieldErrors = fieldErrors;
  }
}

const getValidationErrors = (errors: unknown): Record<string, string[]> => {
  if (!errors || typeof errors !== 'object') return {};
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages.filter((message): message is string => typeof message === 'string') : [],
    ]).filter(([, messages]) => messages.length > 0),
  );
};

export const promoService = {
  async getEmployeePromos(): Promise<Promo[]> {
    const response = await fetchWithEmployeeAuth(`${API_URL}/employee/pos/promos`);
    if (!response.ok) throw new Error('Failed to load cashier promos.');
    const data: unknown = await response.json();
    return Array.isArray(data) ? data as Promo[] : [];
  },

  async validatePromo(code: string, items: PromoCartItem[], channel: 'customer' | 'cashier' = 'customer'): Promise<PromoValidationResult> {
    const path = channel === 'cashier' ? '/employee/pos/promos/validate' : '/promos/validate';
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim().replace(/\s+/g, '').toUpperCase(),
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          ...(item.selected_size ? { selected_size: item.selected_size } : {}),
          selected_addons: item.selected_addons || [],
        })),
      }),
    };
    const response = channel === 'cashier'
      ? await fetchWithEmployeeAuth(`${API_URL}${path}`, init)
      : await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          ...(localStorage.getItem('auth_token')
            ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
            : {}),
        },
      });
    const data = await response.json();

    return {
      isValid: Boolean(response.ok && data.isValid),
      discount: Number(data.discount || 0),
      code: typeof data.code === 'string' ? data.code : undefined,
      message: typeof data.message === 'string' ? data.message : undefined,
      errorCode: typeof data.error_code === 'string' ? data.error_code : undefined,
      amountRemaining: Number.isFinite(Number(data.amount_remaining)) ? Number(data.amount_remaining) : undefined,
    };
  },

  // Admin CRUD
  async getAllPromos(filter?: { status?: string; search?: string; channel?: string }): Promise<Promo[]> {
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== 'all') params.append('status', filter.status);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.channel && filter.channel !== 'all') params.append('channel', filter.channel);

    const res = await fetchWithAdminAuth(`${API_URL}/admin/promos?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch promos');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async createPromo(formData: FormData): Promise<Promo> {
    const res = await fetchWithAdminAuth(`${API_URL}/admin/promos`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      const fieldErrors = getValidationErrors(data.errors);
      const msg = Object.values(fieldErrors).flat().join(', ') || data.message || 'Failed to create promo';
      throw new PromoRequestError(msg, fieldErrors);
    }
    return data.promo;
  },

  async updatePromo(id: string, formData: FormData): Promise<Promo> {
    formData.append('_method', 'PUT');
    const res = await fetchWithAdminAuth(`${API_URL}/admin/promos/${id}`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      const fieldErrors = getValidationErrors(data.errors);
      const msg = Object.values(fieldErrors).flat().join(', ') || data.message || 'Failed to update promo';
      throw new PromoRequestError(msg, fieldErrors);
    }
    return data.promo;
  },

  async deletePromo(id: string): Promise<void> {
    const res = await fetchWithAdminAuth(`${API_URL}/admin/promos/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete promo');
    }
  },

  async toggleActive(id: string): Promise<Promo> {
    const res = await fetchWithAdminAuth(`${API_URL}/admin/promos/${id}/toggle-active`, {
      method: 'PATCH',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to toggle promo status');
    }
    return data.promo;
  },
};
