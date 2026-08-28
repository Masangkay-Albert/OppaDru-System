// src/utils/formatters.ts

export const formatCurrency = (amount: number | string | null | undefined): string => {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const formatted = safeAmount.toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${formatted}`;
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

export const formatPrice = (amount: number): string => {
  return `₱${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const formatCurrencyWithoutSign = (amount: number): string => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};