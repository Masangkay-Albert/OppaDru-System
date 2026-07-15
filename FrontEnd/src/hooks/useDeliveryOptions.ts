// src/hooks/useDeliveryOptions.ts
import { useState, useCallback } from 'react';
import { getAvailableDates, generateTimeSlots } from '../services/checkoutService';

export const useDeliveryOptions = () => {
  const [deliveryOption, setDeliveryOption] = useState<'standard' | 'priority' | 'scheduled'>('standard');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  
  const availableDates = getAvailableDates();
  const timeSlots = generateTimeSlots();
  
  const getScheduleDisplay = useCallback(() => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${dateStr} at ${selectedTime}`;
    }
    return 'Select date & time';
  }, [selectedDate, selectedTime]);
  
  const confirmSchedule = useCallback(() => {
    if (selectedDate && selectedTime) {
      setDeliveryOption('scheduled');
      setShowSchedule(false);
      return true;
    }
    return false;
  }, [selectedDate, selectedTime]);
  
  return {
    deliveryOption,
    setDeliveryOption,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    showSchedule,
    setShowSchedule,
    availableDates,
    timeSlots,
    getScheduleDisplay,
    confirmSchedule
  };
};