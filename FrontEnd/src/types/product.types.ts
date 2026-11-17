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
  is_available?: boolean;
  is_active?: boolean;
  image?: string; 
  addon_group_id?: number;
  quantity?: number;
}

export interface AddonGroup {
  id: number;
  name: string;
  selection_type: 'single' | 'multiple';
  supports_quantity: boolean;
  max_selections?: number;
  addons: Addon[];
  is_active?: boolean;
  applicable_categories?: string[];
}

export interface Product {
  id: string;
  franchise_id?: string | null;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  is_available: boolean;
  isAvailable?: boolean;
  addons?: Addon[];
  addonGroups?: AddonGroup[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  branch_archived?: boolean;
  global_visible_to_all_branches?: boolean;
}

export interface Category {
  id: ProductCategory;
  name: string;
  icon: string;
}

export type ProductSize = 'Small' | 'Medium' | 'Large';

export interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  selectedAddons?: Addon[];
  specialInstructions?: string;
  selectedSize?: ProductSize;
  cartIssue?: 'unavailable' | 'price-changed';
  currentBranchPrice?: number;
  priceUpdateNotice?: {
    previousPrice: number;
    currentPrice: number;
    removedOptions: boolean;
  };
}