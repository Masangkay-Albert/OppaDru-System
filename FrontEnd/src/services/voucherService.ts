// src/services/voucherService.ts
import { promoService, type Promo } from './promoService';
import { VOUCHERS } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

export interface VoucherResult {
  isValid: boolean;
  discount: number;
  promo?: Promo;
  error?: string;
  message?: string;
}

/**
 * Validates a promo/voucher code asynchronously with the database API.
 */
export const validateVoucherAsync = async (
  code: string,
  subtotal: number,
  items?: Array<{ id: number; price: number; quantity: number }>
): Promise<VoucherResult> => {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { isValid: false, discount: 0, error: 'Please enter a voucher code' };
  }

  try {
    const res = await promoService.validatePromo(cleanCode, subtotal, items || []);

    if (res.isValid) {
      return {
        isValid: true,
        discount: Number(res.discount || 0),
        promo: res.promo,
        message: res.message || 'Promo applied successfully!',
      };
    }

    return {
      isValid: false,
      discount: 0,
      error: res.message || 'Invalid or inactive promo code',
    };
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || err?.message;
    if (errMsg) {
      return { isValid: false, discount: 0, error: errMsg };
    }

    // Offline fallback to legacy constants
    return validateAndApplyVoucher(cleanCode, subtotal);
  }
};

/**
 * Synchronous validation fallback.
 */
export const validateAndApplyVoucher = (code: string, subtotal: number): VoucherResult => {
  const upperCode = code.trim().toUpperCase();

  if (upperCode === VOUCHERS.OPPA10.code) {
    const discount = Math.round(subtotal * 0.10);
    return { isValid: true, discount };
  }

  if (upperCode === VOUCHERS.OPPA20.code) {
    if (subtotal >= VOUCHERS.OPPA20.minOrder) {
      const discount = Math.round(subtotal * 0.20);
      return { isValid: true, discount };
    }
    return {
      isValid: false,
      discount: 0,
      error: `Minimum order of ${formatCurrency(VOUCHERS.OPPA20.minOrder)} required`,
    };
  }

  return { isValid: false, discount: 0, error: 'Invalid voucher code' };
};
