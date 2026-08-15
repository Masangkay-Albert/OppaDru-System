import type { Product } from '../types/product.types';
import { productService } from './productService';

const OVERRIDES_KEY = 'adminProductOverrides';
const CUSTOM_KEY = 'adminCustomProducts';
const DELETED_KEY = 'adminDeletedProducts';

interface Overrides {
  [productId: string]: Partial<Product>;
}

type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_available' | 'isAvailable'> & {
  is_available?: boolean;
  isAvailable?: boolean;
};

const withAvailability = <T extends ProductInput | Product>(product: T): T & { is_available: boolean; isAvailable: boolean; price: number } => {
  const isAvailable = product.is_available ?? product.isAvailable ?? true;

  return {
    ...product,
    price: Number(product.price),
    is_available: isAvailable,
    isAvailable,
  };
};

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

const getDeletedProducts = (): string[] => {
  return JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
};

const saveDeletedProducts = (productIds: string[]): void => {
  localStorage.setItem(DELETED_KEY, JSON.stringify(productIds));
};

const notifyProductsUpdated = (): void => {
  window.dispatchEvent(new Event('products-updated'));
};

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const deletedProductIds = new Set(getDeletedProducts());
    const overrides = getOverrides();

    const supabaseProducts = await productService.getProducts();

    const filtered = supabaseProducts
      .filter((p) => !deletedProductIds.has(p.id))
      .map((p) => withAvailability({ ...p, ...(overrides[p.id] || {}) }));

    const custom = getCustomProducts()
      .filter((p) => !deletedProductIds.has(p.id))
      .map((p) => withAvailability({ ...p, ...(overrides[p.id] || {}) }));

    const allProducts = [...filtered, ...custom];
    
    return allProducts.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    const custom = getCustomProducts();
    return custom.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });
  }
};

export const toggleAvailability = async (productId: string): Promise<void> => {
  try {
    await productService.toggleAvailability(productId);
    notifyProductsUpdated();
  } catch {
    const all = await getAllProducts();
    const product = all.find((p) => p.id === productId);
    if (!product) return;
    const overrides = getOverrides();
    const nextAvailability = !product.isAvailable;
    overrides[productId] = {
      ...overrides[productId],
      is_available: nextAvailability,
      isAvailable: nextAvailability,
    };
    saveOverrides(overrides);
    notifyProductsUpdated();
  }
};

export const updateProduct = async (productId: string, changes: Partial<Product>): Promise<void> => {
  try {
    await productService.updateProduct(productId, withAvailability(changes as ProductInput));
    notifyProductsUpdated();
  } catch {
    const overrides = getOverrides();
    overrides[productId] = { ...overrides[productId], ...changes };
    saveOverrides(overrides);
    notifyProductsUpdated();
  }
};

export const addProduct = async (data: ProductInput): Promise<Product> => {
  const productData = withAvailability(data);

  try {
    const newProduct = await productService.createProduct(productData);
    notifyProductsUpdated();
    return newProduct;
  } catch {
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: `custom-${Date.now()}`,
      created_at: now,
      updated_at: now,
    };
    const custom = getCustomProducts();
    custom.push(newProduct);
    saveCustomProducts(custom);
    notifyProductsUpdated();
    return newProduct;
  }
};

export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await productService.deleteProduct(productId);
    const deleted = new Set(getDeletedProducts());
    deleted.add(productId);
    saveDeletedProducts(Array.from(deleted));
    const custom = getCustomProducts().filter((p) => p.id !== productId);
    saveCustomProducts(custom);
    notifyProductsUpdated();
  } catch {
    const deleted = new Set(getDeletedProducts());
    deleted.add(productId);
    saveDeletedProducts(Array.from(deleted));
    const custom = getCustomProducts().filter((p) => p.id !== productId);
    saveCustomProducts(custom);
    notifyProductsUpdated();
  }
};