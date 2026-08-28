// src/utils/formatters.ts

export const formatCurrency = (amount: number): string => {
  const normalized = Number(amount.toFixed(2));
  const formatted = normalized.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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