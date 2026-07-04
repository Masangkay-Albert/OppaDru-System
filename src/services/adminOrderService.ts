// src/services/adminOrderService.ts
import type { Order } from '../contexts/OrderContext';
import type { CartItem } from '../types/product.types';

const ORDERS_KEY = 'orders';
const ONSITE_ORDERS_KEY = 'onsiteOrders';

export type OrderChannel = 'online' | 'onsite';

export interface AdminOrder extends Order {
  channel: OrderChannel;
  customerName?: string;
  served?: boolean;
}

// Online orders come from the customer-side OrderContext ('orders' key).
// Onsite orders are simulated here since there is no cashier module yet —
// admin can add a "walk-in" order manually and it is stored separately.

export const getOnlineOrders = (): AdminOrder[] => {
  const raw = localStorage.getItem(ORDERS_KEY);
  if (!raw) return [];
  try {
    const parsed: Order[] = JSON.parse(raw);
    return parsed.map((o) => ({ ...o, channel: 'online' as const, served: o.status === 'delivered' }));
  } catch {
    return [];
  }
};

export const getOnsiteOrders = (): AdminOrder[] => {
  const raw = localStorage.getItem(ONSITE_ORDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const getAllOrders = (): AdminOrder[] => {
  return [...getOnlineOrders(), ...getOnsiteOrders()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

export const addOnsiteOrder = (data: {
  customerName: string;
  items: { name: string; quantity: number; price: number }[];
  paymentMethod: string;
}): AdminOrder => {
  const total = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const newOrder: AdminOrder = {
    id: `WI-${Date.now()}`,
    userId: `onsite-${Date.now()}`,
    items: data.items.map((i) => {
      const cartItemId = `${i.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: CartItem = {
        id: cartItemId,
        cartItemId,
        name: i.name,
        description: '',
        price: i.price,
        category: 'chicken',
        image: '',
        isAvailable: true,
        quantity: i.quantity,
      };
      return item;
    }),
    total,
    address: 'Onsite / Walk-in',
    coords: { lat: 0, lng: 0 },
    status: 'preparing',
    timestamp: new Date().toISOString(),
    paymentMethod: data.paymentMethod,
    deliveryAddress: 'Onsite / Walk-in',
    deliveryAddressCoords: { lat: 0, lng: 0 },
    channel: 'onsite',
    customerName: data.customerName,
    served: false,
  };

  const existing = getOnsiteOrders();
  const updated = [...existing, newOrder];
  localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(updated));
  return newOrder;
};

export const markOrderServed = (orderId: string, channel: OrderChannel): void => {
  if (channel === 'onsite') {
    const orders = getOnsiteOrders().map((o) =>
      o.id === orderId ? { ...o, served: true, status: 'delivered' as const } : o
    );
    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(orders));
  } else {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return;
    const orders: Order[] = JSON.parse(raw);
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: 'delivered' as const } : o));
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  }
};

export const removeOrder = (orderId: string, channel: OrderChannel): void => {
  if (channel === 'onsite') {
    const orders = getOnsiteOrders().filter((o) => o.id !== orderId);
    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(orders));
  } else {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return;
    const orders: Order[] = JSON.parse(raw);
    const updated = orders.filter((o) => o.id !== orderId);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  }
};
