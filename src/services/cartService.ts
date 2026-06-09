// src/services/cartService.ts
import type { CartItem, Addon } from '../types/product.types';

export const calculateItemTotal = (item: CartItem): number => {
  const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
  return (item.price + addonsTotal) * item.quantity;
};

export const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
};

//  Remove this if not used, or keep it for future use

// export const calculateTotalWithFees = (
//   subtotal: number, 
//   deliveryFee: number, 
//   serviceFee: number,
//   voucherDiscount: number = 0
// ): { subtotalWithFees: number; vat: number; total: number } => {
//   const subtotalWithFees = subtotal + deliveryFee + serviceFee - voucherDiscount;
//   const vat = subtotalWithFees * 0.12;
//   const total = subtotalWithFees + vat;
//   return { subtotalWithFees, vat, total };
// };