// src/utils/constants.ts
export const FEES = {
  DELIVERY: {
    STANDARD: 49,
    PRIORITY: 99
  },
  SERVICE: 29,
  VAT_RATE: 0.12
} as const;

export const VOUCHERS = {
  OPPA10: { code: 'OPPA10', discount: 10, minOrder: 0 },
  OPPA20: { code: 'OPPA20', discount: 20, minOrder: 1000 }
} as const;

export const TIME_SLOTS = {
  START_HOUR: 12,
  END_HOUR: 22,
  INTERVAL_MINUTES: 30
} as const;

// Oppa Dru Store Location - Dasmariñas City Hall area
export const OPPA_DRU_STORE = {
  id: 'main',
  name: 'Oppa Dru Korean Fried Chicken',
  address: 'Dasmariñas City Hall, Lieutenant Cantimbuhan Street, Zone 4, Poblacion, Dasmariñas, Cavite, Philippines, 4114',
  lat: 14.329,
  lng: 120.936
} as const;

export const DELIVERY_SPEED_KM_PER_HOUR = 30;
export const TRACKING_UPDATE_INTERVAL_MS = 2000;

export const ORDER_STATUS = {
  PREPARING: 'preparing',
  ON_THE_WAY: 'on_the_way',
  ARRIVING_SOON: 'arriving_soon',
  DELIVERED: 'delivered'
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const STATUS_MESSAGES: Record<OrderStatus, { message: string; icon: string }> = {
  preparing: { message: 'Preparing your delicious meal', icon: '🍗' },
  on_the_way: { message: 'Driver is on the way!', icon: '🚗' },
  arriving_soon: { message: 'Arriving soon! Get ready', icon: '📍' },
  delivered: { message: 'Order delivered! Enjoy your meal!', icon: '✅' }
};