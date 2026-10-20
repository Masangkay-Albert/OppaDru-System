export const FEES = {
  DELIVERY: { STANDARD: 49, PRIORITY: 99 },
  SERVICE: 29,
  VAT_RATE: 0.12
} as const;

export const VOUCHERS = {
  OPPA10: { code: 'OPPA10', discount: 10, minOrder: 0 },
  OPPA20: { code: 'OPPA20', discount: 20, minOrder: 1000 }
} as const;

export const TIME_SLOTS = { START_HOUR: 12, END_HOUR: 22, INTERVAL_MINUTES: 30 } as const;
export const DELIVERY_SPEED_KM_PER_HOUR = 30;
export const TRACKING_UPDATE_INTERVAL_MS = 2000;

export const ORDER_STATUS = {
  PENDING: 'pending', CONFIRMED: 'confirmed', PREPARING: 'preparing', PREPARED: 'prepared', READY: 'ready',
  SCHEDULED: 'scheduled', ON_THE_WAY: 'on_the_way', ON_WAY: 'on_the_way', ARRIVING: 'arriving', ARRIVED: 'arrived',
  DELIVERED: 'delivered', COMPLETED: 'completed', CANCELLED: 'cancelled', FAILED: 'failed'
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const STATUS_MESSAGES: Record<OrderStatus, { message: string; icon: string }> = {
  pending: { message: 'Order received! Preparing your meal', icon: '' },
  confirmed: { message: 'Your order is confirmed', icon: '' },
  preparing: { message: 'Preparing your delicious meal', icon: '' },
  prepared: { message: 'Order is prepared and waiting for pickup or delivery', icon: '' },
  ready: { message: 'Order is prepared and waiting for a driver', icon: '' },
  scheduled: { message: 'Order is scheduled and waiting for its delivery time', icon: '' },
  on_the_way: { message: 'Driver is on the way!', icon: '' },
  arriving: { message: 'Your driver is arriving', icon: '' },
  arrived: { message: 'Your driver has arrived', icon: '' },
  delivered: { message: 'Order delivered! Enjoy your meal!', icon: '' },
  completed: { message: 'Order completed.', icon: '' },
  cancelled: { message: 'Order cancelled.', icon: '' },
  failed: { message: 'Order could not be completed.', icon: '' }
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', preparing: 'bg-blue-100 text-blue-700',
  prepared: 'bg-purple-100 text-purple-700', ready: 'bg-orange-100 text-orange-700',
  scheduled: 'bg-orange-100 text-orange-700', on_the_way: 'bg-purple-100 text-purple-700',
  arriving: 'bg-purple-100 text-purple-700', arrived: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700', completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700', failed: 'bg-red-100 text-red-700'
};

export const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'prepared', 'ready', 'scheduled', 'on_the_way', 'arriving', 'arrived', 'delivered', 'completed', 'cancelled', 'failed'];
