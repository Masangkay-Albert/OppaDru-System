import { ORDER_STATUS } from './constants';
import { FaHourglassHalf, FaUtensils, FaTruck, FaCheckDouble, FaCalendarAlt } from 'react-icons/fa';

export const STATUS_DISPLAY: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  [ORDER_STATUS.PENDING]: {
    label: 'Pending',
    icon: <FaHourglassHalf size={12} />,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  [ORDER_STATUS.PREPARING]: {
    label: 'Preparing',
    icon: <FaUtensils size={12} />,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  [ORDER_STATUS.ON_WAY]: {
    label: 'On the way',
    icon: <FaTruck size={12} />,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Delivered',
    icon: <FaCheckDouble size={12} />,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  [ORDER_STATUS.SCHEDULED]: {
    label: 'Scheduled',
    icon: <FaCalendarAlt size={12} />,
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200'
  },
};

export const STATUS_OPTIONS = [
  { value: ORDER_STATUS.PENDING, label: 'Pending' },
  { value: ORDER_STATUS.SCHEDULED, label: 'Scheduled' },
  { value: ORDER_STATUS.ON_WAY, label: 'On the Way' },
  { value: ORDER_STATUS.DELIVERED, label: 'Delivered' },
];

export const getStatusColor = (status: string) => {
  switch (status) {
    case ORDER_STATUS.PENDING: return 'border-amber-200 bg-amber-50';
    case ORDER_STATUS.PREPARING: return 'border-blue-200 bg-blue-50';
    case ORDER_STATUS.SCHEDULED: return 'border-orange-200 bg-orange-50';
    case ORDER_STATUS.ON_WAY: return 'border-purple-200 bg-purple-50';
    case ORDER_STATUS.DELIVERED: return 'border-emerald-200 bg-emerald-50';
    default: return 'border-gray-200 bg-gray-50';
  }
};

export const getScheduledOrderDetails = (order: any) => {
  const rawScheduleDisplay = order?.scheduleDisplay || order?.schedule_display || order?.scheduledDisplay || order?.scheduled_display || '';
  const scheduledAt = order?.scheduledAt || order?.scheduled_at || order?.scheduledDateTime || null;
  const scheduledDate = order?.scheduledDate || order?.scheduled_date || null;
  const scheduledTime = order?.scheduledTime || order?.scheduled_time || order?.scheduleWindow || order?.schedule_window || null;
  const deliveryType = order?.deliveryType || order?.delivery_type || null;

  const toDisplayDate = (value: string | Date | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  };

  const toDisplayTime = (value: string | null): string | null => {
    if (!value) return null;
    if (/\d{1,2}:\d{2}\s?(AM|PM)/i.test(value) || /\d{1,2}\s?(AM|PM)/i.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  const resolvedDate = scheduledDate || (scheduledAt ? new Date(scheduledAt) : null);
  const parsedDateText = toDisplayDate(resolvedDate as string | Date | null) ??
    (rawScheduleDisplay ? rawScheduleDisplay.split(/[•|]/)[0]?.trim() || null : null);

  const resolvedTime = scheduledTime || (
    rawScheduleDisplay && rawScheduleDisplay.includes(' at ')
      ? rawScheduleDisplay.split(' at ').slice(-1)[0]
      : null
  );

  const isScheduled = Boolean(
    deliveryType === 'scheduled' ||
    rawScheduleDisplay ||
    scheduledAt ||
    scheduledDate ||
    scheduledTime ||
    order?.status === 'scheduled'
  );

  const finalDisplayDate = parsedDateText || (scheduledAt ? toDisplayDate(new Date(scheduledAt)) : null);
  const finalDisplayTime = toDisplayTime(resolvedTime) || (scheduledAt ? new Date(scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : null);

  return {
    isScheduled,
    displayLabel: isScheduled ? 'Scheduled Order' : null,
    scheduledDate: finalDisplayDate,
    scheduledTime: finalDisplayTime,
    scheduleDisplay: rawScheduleDisplay || (finalDisplayDate && finalDisplayTime ? `${finalDisplayDate} • ${finalDisplayTime}` : null),
  };
};

export const formatOrderDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return 'N/A';
  }
};

export const formatOrderTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return 'N/A';
  }
};