import { useMemo } from 'react';
import type { CartItem } from '../types/product.types';
import { calculateIncludedVat, calculateSubtotal } from '../services/cartService';
import { useSettings } from '../contexts/SettingsContext';
import { FEES } from '../utils/constants';

interface UseCartCalculationsProps {
  cartItems: CartItem[];
  deliveryType: 'standard' | 'priority' | 'scheduled';
  voucherDiscount: number;
  discount?: number;
  deliveryCoordinates?: { lat: number; lng: number };
}

export const useCartCalculations = ({ 
  cartItems, 
  deliveryType, 
  voucherDiscount, 
  discount = 0,
  deliveryCoordinates,
}: UseCartCalculationsProps) => {
  const { pricing } = useSettings();
  return useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    const latitude = deliveryCoordinates?.lat ?? pricing.merchant_latitude;
    const longitude = deliveryCoordinates?.lng ?? pricing.merchant_longitude;
    const latitudeDelta = (latitude - pricing.merchant_latitude) * Math.PI / 180;
    const longitudeDelta = (longitude - pricing.merchant_longitude) * Math.PI / 180;
    const merchantLatitude = pricing.merchant_latitude * Math.PI / 180;
    const customerLatitude = latitude * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(merchantLatitude) * Math.cos(customerLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    const distanceKm = Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 1000) / 1000;
    const deliveryFee = Math.round(Math.min(
      pricing.delivery_max_fee,
      Math.max(0, pricing.delivery_base_fee + Math.max(0, distanceKm - pricing.delivery_base_distance_km) * pricing.delivery_per_km_rate)
    ));
    const serviceFee = Math.round(Math.min(pricing.service_fee_max, Math.max(pricing.service_fee_min, subtotal * pricing.service_fee_rate)));
    const priorityFee = deliveryType === 'priority' ? FEES.DELIVERY.PRIORITY : 0;
    
    const subtotalWithFees = subtotal + deliveryFee + serviceFee + priorityFee;
    const discountAmount = Math.round(subtotalWithFees * discount);
    const roundedVoucherDiscount = Math.round(voucherDiscount);
    const afterDiscount = Math.max(0, subtotalWithFees - discountAmount - roundedVoucherDiscount);
    const vat = calculateIncludedVat(subtotal, pricing.vat_rate);
    const total = Math.round(afterDiscount);
    
    return {
      subtotal,
      deliveryFee,
      serviceFee,
      priorityFee,
      discountAmount,
      voucherDiscount: roundedVoucherDiscount,
      vat,
      total,
      hasItems: cartItems.length > 0
    };
  }, [cartItems, deliveryType, voucherDiscount, discount, pricing, deliveryCoordinates]);
};