import { useMemo } from 'react';
import type { CartItem } from '../types/product.types';
import { calculateSubtotal } from '../services/cartService';
import { useSettings } from '../contexts/SettingsContext';

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
  const { pricing } = useSettings();
  return useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    const deliveryFee = deliveryType === 'priority' ? pricing.delivery_fee_priority : pricing.delivery_fee_standard;
    const serviceFee = pricing.service_fee;
    
    const subtotalWithFees = subtotal + deliveryFee + serviceFee;
    const discountAmount = subtotalWithFees * discount;
    const afterDiscount = subtotalWithFees - discountAmount - voucherDiscount;
    const vat = afterDiscount * pricing.vat_rate;
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
  }, [cartItems, deliveryType, voucherDiscount, discount, pricing]);
};