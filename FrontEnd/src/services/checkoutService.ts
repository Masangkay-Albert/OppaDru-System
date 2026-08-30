// src/services/checkoutService.ts
const START_MINUTES = 11 * 60 + 30;
const END_MINUTES = 22 * 60 + 30;

export const getAvailableDates = (): Array<{ date: Date; label: string }> => {
  const dates = [];
  const today = new Date();
  
  dates.push({ date: new Date(today), label: 'Today' });
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  dates.push({ date: tomorrow, label: 'Tomorrow' });
  
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 2);
  dates.push({ date: nextDay, label: 'Day After Tomorrow' });
  
  return dates;
};

export const generateTimeSlots = (selectedDate?: Date | null): string[] => {
  const slots: string[] = [];
  const now = new Date();
  const isToday = selectedDate && selectedDate.toDateString() === now.toDateString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  for (let totalMinutes = START_MINUTES; totalMinutes <= END_MINUTES; totalMinutes += 30) {
    if (isToday && totalMinutes <= currentMinutes) continue;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${period}`);
  }
  return slots;
};