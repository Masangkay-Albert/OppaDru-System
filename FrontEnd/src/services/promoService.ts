import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';

export interface Promo {
  id: string;
  code?: string;
  title: string;
  description?: string;
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
  times_used?: number;
  created_at?: string;
}

export interface PromoValidationResult {
  isValid: boolean;
  discount: number;
  promo?: Promo;
  message?: string;
}

export const promoService = {
  // Public/Customer/Cashier: get all active promos
  async getActivePromos(): Promise<Promo[]> {
    try {
      const res = await fetch(`${API_URL}/promos`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Failed to fetch active promos:', err);
      return [];
    }
  },

  // Validate a promo code against current cart
  async validatePromo(code: string, subtotal: number, items: any[] = []): Promise<PromoValidationResult> {
    try {
      const res = await fetch(`${API_URL}/promos/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), subtotal, items }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          isValid: false,
          discount: 0,
          message: data.message || 'Could not validate promo code.',
        };
      }

      return {
        isValid: Boolean(data.isValid),
        discount: Number(data.discount || 0),
        promo: data.promo,
        message: data.message,
      };
    } catch {
      return {
        isValid: false,
        discount: 0,
        message: 'Unable to connect to promo verification server.',
      };
    }
  },

  // Admin CRUD
  async getAllPromos(filter?: { status?: string; search?: string }): Promise<Promo[]> {
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== 'all') params.append('status', filter.status);
    if (filter?.search) params.append('search', filter.search);

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
      const msg = data.errors ? Object.values(data.errors).flat().join(', ') : (data.message || 'Failed to create promo');
      throw new Error(msg);
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
      const msg = data.errors ? Object.values(data.errors).flat().join(', ') : (data.message || 'Failed to update promo');
      throw new Error(msg);
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

