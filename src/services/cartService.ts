// src/services/cartService.ts
import type { CartItem } from '../types/product.types';

export const calculateItemTotal = (item: CartItem): number => {
  const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
  return (item.price + addonsTotal) * item.quantity;
};

export const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
};