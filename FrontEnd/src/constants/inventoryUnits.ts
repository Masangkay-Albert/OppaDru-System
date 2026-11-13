import { INPUT_LIMITS } from './inputLimits';

export const COUNTABLE_INVENTORY_UNITS = ['pcs', 'pack', 'box', 'tray', 'bottle', 'can', 'sack'] as const;
export const LEGACY_INVENTORY_UNITS = ['kg', 'g', 'l', 'ml', 'piece'] as const;
export const INVENTORY_UNITS = [...COUNTABLE_INVENTORY_UNITS] as const;
export const MAX_TOTAL_PRICE_PAID = INPUT_LIMITS.totalPricePaid.max;
export const MAX_TOTAL_PRICE_PAID_TEXT = '9999999.99';

export const sanitizeTotalPriceInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const decimalIndex = cleaned.indexOf('.');
  const normalized = decimalIndex < 0
    ? cleaned
    : `${cleaned.slice(0, decimalIndex)}.${cleaned.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2)}`;

  return normalized.slice(0, 10);
};

export const isValidTotalPriceInput = (value: string): boolean =>
  /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) <= MAX_TOTAL_PRICE_PAID;

export const formatInventoryUnitOption = (unit: string): string => {
  const normalized = unit.trim().toLowerCase();
  return LEGACY_INVENTORY_UNITS.includes(normalized as typeof LEGACY_INVENTORY_UNITS[number])
    ? `${normalized} (old unit)`
    : normalized;
};

export const getInventoryUnitOptions = (currentUnit?: string | null): string[] => {
  const normalizedCurrent = currentUnit?.trim().toLowerCase();
  const options = [...COUNTABLE_INVENTORY_UNITS];
  if (!normalizedCurrent || options.includes(normalizedCurrent as typeof options[number])) {
    return options;
  }

  return [...options, normalizedCurrent];
};

export const isWholeQuantityUnit = (unit?: string | null): boolean => COUNTABLE_INVENTORY_UNITS.includes((unit ?? '').trim().toLowerCase() as typeof COUNTABLE_INVENTORY_UNITS[number]);
