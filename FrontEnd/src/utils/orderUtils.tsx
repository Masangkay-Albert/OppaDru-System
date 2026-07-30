import { ORDER_STATUS } from './constants';
import { FaHourglassHalf, FaUtensils, FaTruck, FaCheckDouble } from 'react-icons/fa';
import { FiPackage } from 'react-icons/fi';

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
};

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Orders' },
  { value: ORDER_STATUS.PENDING, label: 'Pending' },
  { value: ORDER_STATUS.PREPARING, label: 'Preparing' },
  { value: ORDER_STATUS.ON_WAY, label: 'On the way' },
  { value: ORDER_STATUS.DELIVERED, label: 'Delivered' },
];

export const getStatusColor = (status: string) => {
  switch (status) {
    case ORDER_STATUS.PENDING: return 'border-amber-200 bg-amber-50';
    case ORDER_STATUS.PREPARING: return 'border-blue-200 bg-blue-50';
    case ORDER_STATUS.ON_WAY: return 'border-purple-200 bg-purple-50';
    case ORDER_STATUS.DELIVERED: return 'border-emerald-200 bg-emerald-50';
    default: return 'border-gray-200 bg-gray-50';
  }
};

export const formatOrderDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export const formatOrderTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'N/A';
  }
};