export const INPUT_LIMITS = {
  ingredientName: { min: 2, max: 50 },
  personName: { min: 2, max: 60 },
  firstOrLastName: { min: 1, max: 30 },
  businessName: { min: 2, max: 80 },
  productName: { min: 2, max: 50 },
  categoryOrSupplierName: { min: 2, max: 50 },
  shortDescription: { max: 120 },
  longText: { max: 255 },
  reason: { min: 3, max: 200 },
  announcementTitle: { min: 3, max: 80 },
  announcementBody: { max: 1000 },
  search: { max: 100 },
  email: { max: 254 },
  password: { min: 8, max: 64 },
  username: { min: 4, max: 30 },
  promoCode: { min: 4, max: 20 },
  reference: { max: 30 },
  amount: { max: 999_999.99 },
  inventoryQuantity: { max: 999_999.999 },
  percentage: { max: 100 },
  inventoryConversion: { max: 999_999 },
  totalPricePaid: { max: 9_999_999.99 },
} as const;

export const INPUT_PATTERNS = {
  ingredientName: /^[\p{L}\p{N} '&.,()/-]+$/u,
} as const;

export type InputFilter =
  | 'personName'
  | 'businessName'
  | 'ingredientName'
  | 'digits'
  | 'phone'
  | 'promoCode'
  | 'reference'
  | 'inventoryQuantity'
  | 'amount'
  | 'totalPrice';

const sanitizeDecimal = (value: string, integerDigits: number, decimalDigits: number): string => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const decimalIndex = cleaned.indexOf('.');
  const integerPart = (decimalIndex < 0 ? cleaned : cleaned.slice(0, decimalIndex)).slice(0, integerDigits);
  if (decimalIndex < 0) return integerPart;
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/\./g, '').slice(0, decimalDigits);
  return `${integerPart}.${decimalPart}`;
};

const sanitizeName = (value: string, pattern: RegExp): string =>
  value.replace(pattern, '').replace(/ {2,}/g, ' ');

const filters: Record<InputFilter, (value: string) => string> = {
  personName: (value) => sanitizeName(value, /[^\p{L} .'-]/gu),
  businessName: (value) => sanitizeName(value, /[^\p{L}\p{N} '&.,()/-]/gu),
  ingredientName: (value) => sanitizeName(value, /[^\p{L}\p{N} '&.,()/-]/gu),
  digits: (value) => value.replace(/\D/g, ''),
  phone: (value) => value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''),
  promoCode: (value) => value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase(),
  reference: (value) => value.replace(/[^a-zA-Z0-9-]/g, ''),
  inventoryQuantity: (value) => sanitizeDecimal(value, 6, 3),
  amount: (value) => sanitizeDecimal(value, 6, 2),
  totalPrice: (value) => sanitizeDecimal(value, 7, 2),
};

export const sanitizeInputValue = (value: string, filter: InputFilter): string => filters[filter](value);

export const normalizePhilippinePhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('63') ? `0${digits.slice(2)}` : digits;
};
