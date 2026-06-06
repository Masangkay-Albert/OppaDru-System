// src/types/product.types.ts
export type ProductCategory = 
  | 'all'
  | 'rice-meals'
  | 'sulit-meals'
  | 'chicken'
  | 'beverages'
  | 'snacks'
  | 'side-dishes';

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  image: string;
  isAvailable: boolean;
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
  };
}

export interface Category {
  id: ProductCategory;
  name: string;
  icon: string;
}

export interface CartItem extends Product {
  quantity: number;
  selectedAddons?: Addon[];      
  specialInstructions?: string;  
}