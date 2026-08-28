import { useMemo } from 'react';
import type { CartItem } from '../types/product.types';
import { calculateSubtotal } from '../services/cartService';
import { getDeliveryFee } from '../services/checkoutService';
import { FEES } from '../utils/constants';

interface UseCartCalculationsProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority';
  voucherDiscount: number;
  discount?: number;
}

export const useCartCalculations = ({ 
  cartItems, 
  deliveryType, 
  voucherDiscount, 
  discount = 0 
}: UseCartCalculationsProps) => {
  return useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    const deliveryFee = getDeliveryFee(deliveryType);
    const serviceFee = FEES.SERVICE;
    
    const subtotalWithFees = subtotal + deliveryFee + serviceFee;
    const discountAmount = subtotalWithFees * discount;
    const afterDiscount = subtotalWithFees - discountAmount - voucherDiscount;
    const vat = afterDiscount * FEES.VAT_RATE;
    const total = Math.round((afterDiscount + vat) * 100) / 100;
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      discountAmount,
      vat,
      total,
      hasItems: cartItems.length > 0
    };
  }, [cartItems, deliveryType, voucherDiscount, discount]);
};