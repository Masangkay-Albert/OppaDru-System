import { isWholeQuantityUnit } from '../constants/inventoryUnits';

export const formatInventoryQuantity = (value: number | string, unit: string): string => {
  const quantity = Number(value);
  const normalizedUnit = unit.trim().toLowerCase();
  const isWholeQuantity = isWholeQuantityUnit(normalizedUnit) && Number.isInteger(quantity);
  const formatted = Number.isFinite(quantity)
    ? quantity.toLocaleString('en-PH', {
      maximumFractionDigits: isWholeQuantity ? 0 : 3,
    })
    : '0';

  return `${formatted} ${unit}`;
};
