// src/services/checkoutService.ts
import { FEES, TIME_SLOTS } from '../utils/constants';

export const getDeliveryFee = (type: 'standard' | 'priority'): number => {
  return type === 'priority' ? FEES.DELIVERY.PRIORITY : FEES.DELIVERY.STANDARD;
};

export const getAvailableDates = (): Array<{ date: Date; label: string }> => {
  const dates = [];
  const today = new Date();
  
  dates.push({ date: new Date(today), label: 'Today' });
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  dates.push({ date: tomorrow, label: 'Tomorrow' });
  
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 2);
  dates.push({ date: nextDay, label: nextDay.toLocaleDateString('en-US', { weekday: 'short' }) });
  
  return dates;
};

export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  // Convert to numbers to avoid literal type issues
  const startHour: number = TIME_SLOTS.START_HOUR;
  const endHour: number = TIME_SLOTS.END_HOUR;
  const intervalMinutes: number = TIME_SLOTS.INTERVAL_MINUTES;
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute of [0, intervalMinutes]) {
      if (hour === endHour && minute === intervalMinutes) continue;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour;
      slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${period}`);
    }
  }
  return slots;
};