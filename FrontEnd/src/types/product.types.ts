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
  category: string;
  image: string;
  is_available: boolean;
  isAvailable?: boolean;
  addons?: Addon[];
  created_at?: string;
  updated_at?: string;
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