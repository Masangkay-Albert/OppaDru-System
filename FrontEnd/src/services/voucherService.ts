import { promoService, type PromoCartItem, type PromoValidationResult } from './promoService';

export interface VoucherResult {
  isValid: boolean;
  discount: number;
  code?: string;
  error?: string;
  errorCode?: string;
}

const errorMessage = (result: PromoValidationResult): string => {
  switch (result.errorCode) {
    case 'PROMO_REQUIRED':
      return 'Please enter a promo code.';
    case 'PROMO_INVALID':
      return "This promo code isn't valid. Please check and try again.";
    case 'PROMO_EXPIRED':
      return 'This promo code has expired.';
    case 'PROMO_NOT_STARTED':
      return "This promo code isn't active yet.";
    case 'PROMO_NO_APPLICABLE_ITEMS':
      return "This promo doesn't apply to the items in your cart.";
    case 'PROMO_MIN_ORDER':
      return `Add ₱${(result.amountRemaining || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more to use this promo.`;
    case 'PROMO_USAGE_LIMIT':
      return 'This promo code has reached its usage limit.';
    case 'PROMO_RATE_LIMITED':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'PROMO_CHANGED':
      return 'This promo is no longer available. Please apply the code again.';
    case 'PROMO_INVALID_REQUEST':
      return 'Please check the promo code and cart, then try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

export const validateVoucherAsync = async (
  code: string,
  items: PromoCartItem[],
  channel: 'customer' | 'cashier' = 'customer',
  franchiseId?: string | null,
): Promise<VoucherResult> => {
  if (!code.trim()) {
    return { isValid: false, discount: 0, errorCode: 'PROMO_REQUIRED', error: 'Please enter a promo code.' };
  }

  try {
    const result = await promoService.validatePromo(code, items, channel, franchiseId);
    return result.isValid
      ? { isValid: true, discount: result.discount, code: result.code }
      : { isValid: false, discount: 0, errorCode: result.errorCode, error: errorMessage(result) };
  } catch (error: unknown) {
    console.error('Promo validation request failed.', error);
    return { isValid: false, discount: 0, errorCode: 'PROMO_NETWORK_ERROR', error: 'Something went wrong. Please try again.' };
  }
};
