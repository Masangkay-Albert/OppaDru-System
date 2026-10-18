// src/utils/locationUtils.ts

export const cleanAddress = (address: string): string => {
  if (!address) return address;

  let cleaned = address;
  cleaned = cleaned.replace(/,\s*Philippines\s*,?/gi, '');
  cleaned = cleaned.replace(/,\s*Calabarzon\s*,?/gi, '');
  cleaned = cleaned.replace(/\b\d{4,5}\b(?!\s*$)/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/,\s*$/, '');

  return cleaned;
};

export const getShortName = (fullAddress: string): string => {
  const parts = fullAddress.split(',');
  if (!parts.length) return fullAddress;

  let name = parts[0].trim();
  name = name.replace(/\b\d{4,5}\b/g, '').trim();

  return name;
};
