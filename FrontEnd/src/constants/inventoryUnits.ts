export const COUNTABLE_INVENTORY_UNITS = ['pcs', 'pack', 'box', 'tray', 'bottle', 'can', 'sack'] as const;
export const LEGACY_INVENTORY_UNITS = ['kg', 'g', 'l', 'ml', 'piece'] as const;
export const INVENTORY_UNITS = [...COUNTABLE_INVENTORY_UNITS] as const;

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
