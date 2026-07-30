const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { getProductImage } from '../data/productImages';

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
    created_at: string;
    updated_at: string;
}

class ProductService {
    private tokenKey = 'auth_token';
    private cacheKey = 'cached_available_products';

    private getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    private getHeaders(): HeadersInit {
        const token = this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    private getCachedProducts(): Product[] {
        const cached = localStorage.getItem(this.cacheKey);
        if (!cached) {
            return [];
        }

        try {
            return JSON.parse(cached) as Product[];
        } catch {
            return [];
        }
    }

    private saveCachedProducts(products: Product[]): void {
        localStorage.setItem(this.cacheKey, JSON.stringify(products));
    }

    async getProducts(): Promise<Product[]> {
        const response = await fetch(`${API_URL}/products`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        const products = await response.json();
        return products.map((p: any) => ({
            ...p,
            price: Number(p.price),
            isAvailable: p.is_available,
            image: getProductImage(p.image)
        }));
    }

    async getAvailableProducts(): Promise<Product[]> {
        try {
            const response = await fetch(`${API_URL}/products/available`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch available products');
            }

            const products = await response.json();
            const mappedProducts = products.map((p: any) => ({
                ...p,
                price: Number(p.price),
                isAvailable: p.is_available,
                image: getProductImage(p.image)
            }));

            this.saveCachedProducts(mappedProducts);
            return mappedProducts;
        } catch (error) {
            console.error('Failed to fetch available products:', error);
            return this.getCachedProducts();
        }
    }

    async getProductsByCategory(category: string): Promise<Product[]> {
        const response = await fetch(`${API_URL}/products/category/${category}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch products by category');
        }

        const products = await response.json();
        return products.map((p: any) => ({
            ...p,
            price: Number(p.price),
            isAvailable: p.is_available,
            image: getProductImage(p.image)
        }));
    }

    async getProduct(id: string): Promise<Product> {
        const response = await fetch(`${API_URL}/products/${id}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch product');
        }

        const product = await response.json();
        return {
            ...product,
            price: Number(product.price),
            isAvailable: product.is_available,
            image: getProductImage(product.image)
        };
    }

    async uploadImage(file: File, folder: string = 'products'): Promise<string> {
        const token = this.getToken();
        const formData = new FormData();
        formData.append('image', file);
        formData.append('folder', folder);

        const response = await fetch(`${API_URL}/products/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload image');
        }

        const result = await response.json();
        return result.url;
    }

    async createProduct(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>, imageFile?: File): Promise<Product> {
        let imageUrl = data.image || '';

        if (imageFile) {
            const category = data.category || 'products';
            imageUrl = await this.uploadImage(imageFile, category);
        }

        const productData = {
            ...data,
            image: imageUrl,
        };

        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(productData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create product');
        }

        const result = await response.json();
        return {
            ...result.product,
            price: Number(result.product.price),
            isAvailable: result.product.is_available,
            image: getProductImage(result.product.image)
        };
    }

    async updateProduct(id: string, data: Partial<Product>, imageFile?: File): Promise<Product> {
        let imageUrl = data.image || '';

        if (imageFile) {
            const category = data.category || 'products';
            imageUrl = await this.uploadImage(imageFile, category);
            data.image = imageUrl;
        }

        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update product');
        }

        const result = await response.json();
        return {
            ...result.product,
            price: Number(result.product.price),
            isAvailable: result.product.is_available,
            image: getProductImage(result.product.image)
        };
    }

    async deleteProduct(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to delete product');
        }
    }

    async toggleAvailability(id: string): Promise<Product> {
        const response = await fetch(`${API_URL}/products/${id}/toggle`, {
            method: 'PATCH',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to toggle product availability');
        }

        const result = await response.json();
        return {
            ...result.product,
            price: Number(result.product.price),
            isAvailable: result.product.is_available,
            image: getProductImage(result.product.image)
        };
    }
}

export const productService = new ProductService();
