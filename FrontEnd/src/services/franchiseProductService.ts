import type { Product } from '../types/product.types';
import { API_URL } from './apiConfig';
import { fetchWithFranchiseAuth } from './franchiseAuthService';
import type { ProductPageAdapter } from '../modules/shared/components/ProductsPage';

interface ApiProduct extends Product {
  branch_available?: boolean;
}

const mapBranchProduct = (product: ApiProduct): Product => {
  const available = product.branch_available ?? product.is_available;
  return {
    ...product,
    price: Number(product.price),
    is_available: available,
    isAvailable: available,
  };
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Branch product request failed (${response.status}).`);
  }
  return payload as T;
};

const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const payload = await requestJson<{ url?: string }>('/franchise/products/upload-image', {
    method: 'POST',
    body: formData,
  });
  if (!payload.url) throw new Error('Image upload succeeded but no image URL was returned.');
  return payload.url;
};

export const franchiseProductAdapter: ProductPageAdapter = {
  async list() {
    const payload = await requestJson<{ data?: { items?: ApiProduct[] } }>('/franchise/inventory', { cache: 'no-store' });
    return (payload.data?.items || []).map(mapBranchProduct);
  },
  async listArchived() {
    const payload = await requestJson<{ data?: ApiProduct[] }>('/franchise/products/archived', { cache: 'no-store' });
    return (payload.data || []).map(mapBranchProduct);
  },
  async create(product) {
    const payload = await requestJson<{ product: ApiProduct }>('/franchise/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
    return mapBranchProduct(payload.product);
  },
  async update(id, changes, imageFile) {
    const image = imageFile ? await uploadImage(imageFile) : changes.image;
    await requestJson(`/franchise/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: changes.name,
        description: changes.description,
        price: changes.price,
        category: changes.category,
        ...(image !== undefined ? { image } : {}),
      }),
    });
  },
  async toggleAvailability(product, available) {
    await requestJson(`/franchise/inventory/${encodeURIComponent(product.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_available: available }),
    });
  },
  async archive(id) {
    await requestJson(`/franchise/products/${encodeURIComponent(id)}/archive`, { method: 'PATCH' });
  },
  async restore(id) {
    await requestJson(`/franchise/products/${encodeURIComponent(id)}/restore`, { method: 'PATCH' });
  },
  async delete(id) {
    await requestJson(`/franchise/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  uploadImage,
};
