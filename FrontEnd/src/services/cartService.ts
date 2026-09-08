// src/services/cartService.ts
import type { CartItem, Addon } from '../types/product.types';

export const generateCartItemId = (
  productId: string,
  selectedAddons?: Addon[],
  specialInstructions?: string,
  selectedSize?: string
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

  const sizeKey = selectedSize ? selectedSize.toLowerCase() : 'no-size';

  return `${productId}__${addonsKey}__${instructionsKey}__${sizeKey}`;
};


export const calculateItemTotal = (item: CartItem): number => {
  const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + Number(addon.price || 0), 0) ?? 0;
  return (item.price * item.quantity) + addonsTotal;
};

export const calculateSubtotal = (items: CartItem[]): number => {
  return Math.round(items.reduce((sum, item) => sum + calculateItemTotal(item), 0) * 100) / 100;
};

export const calculateIncludedVat = (vatInclusiveAmount: number, vatRate: number): number => {
  return Math.round((vatInclusiveAmount * vatRate / (1 + vatRate)) * 100) / 100;
};