// src/services/cartService.ts
import type { CartItem, Addon } from '../types/product.types';

export const generateCartItemId = (
  productId: string,
  selectedAddons?: Addon[],
  specialInstructions?: string
): string => {
  const addonsKey = selectedAddons && selectedAddons.length > 0
    ? [...selectedAddons]
        .map((a) => a.id)
        .sort()
        .join(',')
    : 'no-addons';

  const instructionsKey = specialInstructions?.trim()
    ? specialInstructions.trim().toLowerCase()
    : 'no-notes';

  return `${productId}__${addonsKey}__${instructionsKey}`;
};


export const calculateItemTotal = (item: CartItem): number => {
  const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + Number(addon.price || 0), 0) ?? 0;
  return (item.price * item.quantity) + addonsTotal;
};

export const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
};