// src/services/voucherService.ts
import { VOUCHERS } from '../utils/constants';

export interface VoucherResult {
  isValid: boolean;
  discount: number;
  error?: string;
}

export const validateAndApplyVoucher = (code: string, subtotal: number): VoucherResult => {
  const upperCode = code.toUpperCase();
  
  if (upperCode === VOUCHERS.OPPA10.code) {
    return { isValid: true, discount: VOUCHERS.OPPA10.discount };
  }
  
  if (upperCode === VOUCHERS.OPPA20.code) {
    if (subtotal >= VOUCHERS.OPPA20.minOrder) {
      return { isValid: true, discount: VOUCHERS.OPPA20.discount };
    }
    return { 
      isValid: false, 
      discount: 0, 
      error: `Minimum order of ₱${VOUCHERS.OPPA20.minOrder} required` 
    };
  }
  
  return { isValid: false, discount: 0, error: 'Invalid voucher code' };
};