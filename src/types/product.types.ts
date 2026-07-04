// src/types/product.types.ts
export type ProductCategory = 
  | 'all'
  | 'rice-meals'
  | 'sulit-meals'
  | 'chicken'
  | 'beverages'
  | 'snacks'
  | 'side-dishes'
  | 'fruity-soda-milk'
  | 'noodles'
  | 'fresh-lemonade';

export interface Addon {
  id: string;
  name: string;
  price: number;
  image?: string; 
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
  cartItemId: string;
  quantity: number;
  selectedAddons?: Addon[];      
  specialInstructions?: string;  
}