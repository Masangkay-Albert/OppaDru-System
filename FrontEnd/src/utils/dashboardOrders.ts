export type OrderSortDirection = 'desc' | 'asc';

type DashboardOrder = {
  deliveryType?: string;
  created_at?: string | null;
};

export const sortOrders = <T extends DashboardOrder>(
  orders: readonly T[],
  direction: OrderSortDirection
): T[] =>
  [...orders].sort((a, b) => {
    const priorityOrder =
      Number(b.deliveryType === 'priority') - Number(a.deliveryType === 'priority');
    if (priorityOrder !== 0) return priorityOrder;

    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  });

export const getOrderStatusLabel = (status: string): string => {
  const label = status.toLowerCase().replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const getOrderStatusClasses = (status: string): string => {
  const statusClasses: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-900',
    preparing: 'bg-blue-100 text-blue-900',
    on_the_way: 'bg-purple-100 text-purple-900',
    arrived: 'bg-green-100 text-green-900',
    delivered: 'bg-emerald-50 text-emerald-900',
    completed: 'bg-emerald-50 text-emerald-900',
    cancelled: 'bg-red-100 text-red-900',
    canceled: 'bg-red-100 text-red-900',
    prepared: 'bg-purple-100 text-purple-900',
    ready: 'bg-orange-100 text-orange-900',
    scheduled: 'bg-orange-100 text-orange-900'
  };

  return statusClasses[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
};
