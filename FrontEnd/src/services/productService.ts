const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';
import { getProductImage } from '../data/productImages';
import oppaLogo from '../assets/oppadrulogo.jpg';
import type { AddonGroup } from '../types/product.types';
import { ensureAdminSession, getStoredAdminToken } from './adminAuthService';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  is_available: boolean;
  isAvailable?: boolean;
  addons?: any[];
  addonGroups?: AddonGroup[];
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PRODUCT_IMAGE = '/oppadrulogo.jpg';

class ProductService {
  private tokenKey = 'auth_token';
  private adminTokenKey = 'adminToken';
  private cacheKey = 'cached_available_products';

  private getToken(): string | null { return localStorage.getItem(this.tokenKey); }

  private getAdminToken(): string | null {
    const directToken = localStorage.getItem(this.adminTokenKey);
    if (directToken) return directToken;

    const fallbackToken = getStoredAdminToken();
    if (fallbackToken) {
      localStorage.setItem(this.adminTokenKey, fallbackToken);
      return fallbackToken;
    }

    return null;
  }

  private async ensureValidAdminToken(): Promise<string | null> {
    const token = this.getAdminToken() || await ensureAdminSession();
    if (token) localStorage.setItem(this.adminTokenKey, token);
    return token;
  }

  private getHeaders(useAdminToken = false): HeadersInit {
    const token = useAdminToken ? this.getAdminToken() : this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private mapProduct(product: any): Product {
    return {
      ...product,
      price: Number(product.price ?? 0),
      is_available: product.is_available ?? product.isAvailable ?? true,
      isAvailable: product.is_available ?? product.isAvailable ?? true,
      image: getProductImage(product.image || ''),
      addonGroups: product.addonGroups || product.addon_groups || [],
      created_at: product.created_at || '',
      updated_at: product.updated_at || '',
    };
  }

  private parseProducts(payload: any): Product[] {
    const products = Array.isArray(payload) ? payload : payload?.data ?? [];
    return products.map((p: any) => this.mapProduct(p));
  }

  private async fetchPublicProducts(path: string): Promise<Product[]> {
    const response = await fetch(`${API_URL}${path}`, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch products');
    return this.parseProducts(await response.json());
  }

  private async adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureValidAdminToken();
    if (!token) throw new Error('Unauthorized');

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...this.getHeaders(true), ...(options.headers || {}) },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || 'Request failed');
    }

    return response.json();
  }

  private async adminRequestWithRetry<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      return await this.adminRequest<T>(path, options);
    } catch (error) {
      const retryToken = await ensureAdminSession();
      if (!retryToken) throw error;

      localStorage.setItem(this.adminTokenKey, retryToken);
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${retryToken}`,
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Request failed');
      }

      return response.json();
    }
  }

  async getAddonGroups(category?: string, productId?: string): Promise<AddonGroup[]> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (productId) params.set('product_id', productId);

    const response = await fetch(`${API_URL}/addon-groups?${params.toString()}`, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch add-on groups');
    return response.json();
  }

  async getAdminAddonGroups(): Promise<AddonGroup[]> {
    return this.adminRequest('/addon-groups');
  }

  async createAddonGroup(data: Partial<AddonGroup> & { applicable_categories: string[] }): Promise<AddonGroup> {
    return this.adminRequest('/admin/addon-groups', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateAddonGroup(id: number, data: Partial<AddonGroup>): Promise<AddonGroup> {
    return this.adminRequest(`/admin/addon-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteAddonGroup(id: number): Promise<void> {
    await this.adminRequestWithRetry(`/admin/addon-groups/${id}`, { method: 'DELETE' });
  }

  async createAddon(groupId: number, data: { name: string; price: number; image?: string; is_active?: boolean }): Promise<AddonGroup> {
    return this.adminRequestWithRetry(`/admin/addon-groups/${groupId}/addons`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateAddon(id: number, data: { name?: string; price?: number; image?: string; is_active?: boolean }): Promise<any> {
    return this.adminRequestWithRetry(`/admin/addons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteAddon(id: number): Promise<void> {
    await this.adminRequestWithRetry(`/admin/addons/${id}`, { method: 'DELETE' });
  }

  private getCachedProducts(): Product[] {
    const cached = localStorage.getItem(this.cacheKey);
    if (!cached) return [];

    try { return JSON.parse(cached) as Product[]; } catch { return []; }
  }

  private saveCachedProducts(products: Product[]): void {
    localStorage.setItem(this.cacheKey, JSON.stringify(products));
  }

  async getProducts(): Promise<Product[]> {
    return this.fetchPublicProducts('/products');
  }

  async getAdminProducts(): Promise<Product[]> {
    const token = await this.ensureValidAdminToken();
    if (!token) throw new Error('Failed to fetch admin products');

    const response = await fetch(`${API_URL}/admin/products`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem(this.adminTokenKey);
        const retriedToken = await ensureAdminSession();
        if (retriedToken) {
          const retry = await fetch(`${API_URL}/admin/products`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retriedToken}` },
          });
          if (retry.ok) return this.parseProducts(await retry.json());
        }
      }

      try { return await this.getProducts(); } catch { throw new Error(errorBody.message || 'Failed to fetch admin products'); }
    }

    return this.parseProducts(await response.json());
  }

  async getAvailableProducts(): Promise<Product[]> {
    try {
      const products = await this.fetchPublicProducts('/products');
      const orderedProducts = [...products].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return a.name.localeCompare(b.name);
      });

      this.saveCachedProducts(orderedProducts);
      return orderedProducts;
    } catch {
      return this.getCachedProducts();
    }
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return this.fetchPublicProducts(`/products/category/${category}`);
  }

  async getProduct(id: string): Promise<Product> {
    const response = await fetch(`${API_URL}/products/${id}`, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch product');
    return this.mapProduct(await response.json());
  }

  async uploadImage(file: File, folder: string = 'products'): Promise<string> {
    let token = this.getAdminToken() || await ensureAdminSession();
    if (!token) return DEFAULT_PRODUCT_IMAGE;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);

    try {
      const response = await fetch(`${API_URL}/admin/products/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.status === 401) {
        token = await ensureAdminSession();
        if (!token) return DEFAULT_PRODUCT_IMAGE;

        const retryResponse = await fetch(`${API_URL}/admin/products/upload-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!retryResponse.ok) return DEFAULT_PRODUCT_IMAGE;
        const result = await retryResponse.json();
        return result.url || DEFAULT_PRODUCT_IMAGE;
      }

      if (!response.ok) return DEFAULT_PRODUCT_IMAGE;
      const result = await response.json();
      return result.url || DEFAULT_PRODUCT_IMAGE;
    } catch {
      return DEFAULT_PRODUCT_IMAGE;
    }
  }

  async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, imageFile?: File): Promise<Product> {
    let imageUrl = typeof data.image === 'string' ? data.image.trim() : '';
    if (imageFile) {
      imageUrl = await this.uploadImage(imageFile, data.category || 'products');
    } else if (!imageUrl) {
      imageUrl = DEFAULT_PRODUCT_IMAGE;
    }

    const productData = { ...data, image: imageUrl };
    const result = await this.adminRequestWithRetry<{ product?: Product; [key: string]: any }>(`/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });

    return this.mapProduct(result.product ?? result);
  }

  async updateProduct(id: string, data: Partial<Product>, imageFile?: File): Promise<Product> {
    let payload = { ...data };
    if (imageFile) {
      payload.image = await this.uploadImage(imageFile, data.category || 'products');
    }

    const result = await this.adminRequestWithRetry<{ product?: Product; [key: string]: any }>(`/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return this.mapProduct(result.product ?? result);
  }

  async deleteProduct(id: string): Promise<void> {
    await this.adminRequestWithRetry(`/admin/products/${id}`, { method: 'DELETE' });
  }

  async toggleAvailability(id: string): Promise<Product> {
    const result = await this.adminRequestWithRetry<{ product?: Product; [key: string]: any }>(`/admin/products/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });

    return this.mapProduct(result.product ?? result);
  }
}

export const productService = new ProductService();