// src/services/adminProductService.ts
import type { Product } from '../types/product.types';
import { products as mockProducts } from '../data/mockData';

const OVERRIDES_KEY = 'adminProductOverrides'; // edits/availability toggles keyed by product id
const CUSTOM_KEY = 'adminCustomProducts'; // newly added products

interface Overrides {
  [productId: string]: Partial<Product>;
}

const getOverrides = (): Overrides => {
  return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
};

const saveOverrides = (overrides: Overrides): void => {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
};

const getCustomProducts = (): Product[] => {
  return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
};

const saveCustomProducts = (products: Product[]): void => {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(products));
};

export const getAllProducts = (): Product[] => {
  const overrides = getOverrides();
  const base = mockProducts.map((p) => ({ ...p, ...(overrides[p.id] || {}) }));
  const custom = getCustomProducts().map((p) => ({ ...p, ...(overrides[p.id] || {}) }));
  return [...base, ...custom];
};

export const toggleAvailability = (productId: string): void => {
  const all = getAllProducts();
  const product = all.find((p) => p.id === productId);
  if (!product) return;
  const overrides = getOverrides();
  overrides[productId] = { ...overrides[productId], isAvailable: !product.isAvailable };
  saveOverrides(overrides);
};

export const updateProduct = (productId: string, changes: Partial<Product>): void => {
  const overrides = getOverrides();
  overrides[productId] = { ...overrides[productId], ...changes };
  saveOverrides(overrides);
};

export const addProduct = (data: Omit<Product, 'id'>): Product => {
  const newProduct: Product = { ...data, id: `custom-${Date.now()}` };
  const custom = getCustomProducts();
  custom.push(newProduct);
  saveCustomProducts(custom);
  return newProduct;
};

export const deleteProduct = (productId: string): void => {
  const custom = getCustomProducts().filter((p) => p.id !== productId);
  saveCustomProducts(custom);
};
