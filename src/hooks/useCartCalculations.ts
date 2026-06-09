// src/hooks/useCartCalculations.ts
import { useMemo } from 'react';
import type { CartItem } from '../types/product.types';
import { calculateSubtotal } from '../services/cartService';
import { getDeliveryFee } from '../services/checkoutService';
import { FEES } from '../utils/constants';

interface UseCartCalculationsProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority';
  voucherDiscount: number;
}

export const useCartCalculations = ({ cartItems, deliveryType, voucherDiscount }: UseCartCalculationsProps) => {
  return useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    const deliveryFee = getDeliveryFee(deliveryType);
    const serviceFee = FEES.SERVICE;
    const subtotalWithFees = subtotal + deliveryFee + serviceFee - voucherDiscount;
    const vat = subtotalWithFees * FEES.VAT_RATE;
    const total = subtotalWithFees + vat;
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      vat,
      total,
      hasItems: cartItems.length > 0
    };
  }, [cartItems, deliveryType, voucherDiscount]);
};