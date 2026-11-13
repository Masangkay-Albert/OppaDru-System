export const THIRD_PARTY_PLATFORMS = [
  { key: 'foodpanda', label: 'Foodpanda', referencePrefix: 'FP ref' },
  { key: 'grabfood', label: 'GrabFood', referencePrefix: 'GF ref' },
] as const;

export type ThirdPartyPlatform = typeof THIRD_PARTY_PLATFORMS[number]['key'];
export type OrderSource = 'walk_in' | ThirdPartyPlatform;

export const getThirdPartyPlatformLabel = (platform?: string | null): string | null =>
  THIRD_PARTY_PLATFORMS.find((entry) => entry.key === platform)?.label || null;

export const getThirdPartyReferencePrefix = (platform?: string | null): string | null =>
  THIRD_PARTY_PLATFORMS.find((entry) => entry.key === platform)?.referencePrefix || null;

export const getPaymentMethodLabel = (method?: string | null): string => {
  const normalized = (method || '').trim().toLowerCase().replaceAll('_', ' ');
  const platformLabel = getThirdPartyPlatformLabel(normalized.replaceAll(' ', ''));
  if (platformLabel) return `${platformLabel} (paid by platform)`;

  switch (normalized) {
    case 'cash':
      return 'Cash';
    case 'cash on delivery':
      return 'Cash on Delivery';
    case 'gcash':
      return 'GCash';
    case 'credit card':
    case 'credit-card':
      return 'Credit Card';
    default:
      return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown';
  }
};
