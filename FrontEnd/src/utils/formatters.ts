// src/utils/formatters.ts

type NumericValue = number | string | null | undefined;

const toFiniteNumber = (amount: NumericValue): number => {
  const numericAmount = typeof amount === 'string' ? Number(amount.trim()) : Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
};

export const formatCurrency = (amount: NumericValue): string => {
  const safeAmount = toFiniteNumber(amount);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Math.round(safeAmount));
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTimeSlot = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

export const formatNumber = (amount: number): string => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatPrice = (amount: NumericValue): string => {
  return formatCurrency(amount);
};

export const formatCurrencyWithoutSign = (amount: NumericValue): string => {
  return formatCurrency(amount).replace(/₱\s?/, '');
};