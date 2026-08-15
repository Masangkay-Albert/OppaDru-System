import type { Order } from '../../contexts/OrderContext';
import type { CartItem } from '../types/product.types';
import { getAccountDisplayName } from './adminAuthService';
import { orderService } from './orderService';

const ORDERS_KEY = 'orders';
const ONSITE_ORDERS_KEY = 'onsiteOrders';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getOnlineOrderStorageKeys = (): string[] => {
  const keys: string[] = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key === ORDERS_KEY || key === 'orders_guest' || key.startsWith('orders_user_')) {
      keys.push(key);
    }
  }

  return keys;
};

const updateOnlineOrdersInStorage = (updater: (orders: Order[]) => Order[]): void => {
  const keys = getOnlineOrderStorageKeys();

  keys.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
      const orders: Order[] = JSON.parse(raw);
      const updated = updater(orders);

      if (updated.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {
    }
  });
};

export type OrderChannel = 'online' | 'onsite';

export interface AdminOrder extends Order {
  channel: OrderChannel;
  customerName?: string;
  served?: boolean;
}

const getStoredOnlineOrders = (): Order[] => {
  const seen = new Set<string>();
  const orders: Order[] = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key !== ORDERS_KEY && key !== 'orders_guest' && !key.startsWith('orders_user_')) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: Order[] = JSON.parse(raw);
      parsed.forEach((order) => {
        if (!seen.has(order.id)) {
          seen.add(order.id);
          orders.push(order);
        }
      });
    } catch {
    }
  }

  return orders;
};

export const getOnlineOrders = (): AdminOrder[] => {
  return getStoredOnlineOrders().map((o) => ({
    ...o,
    channel: 'online' as const,
    served: o.status === 'delivered',
    customerName: getAccountDisplayName(o.userId) || 'Customer',
  }));
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

export const getAllOrders = async (): Promise<AdminOrder[]> => {
  try {
    const response = await fetch(`${API_URL}/orders`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders from API');
    }

    const apiOrders = await response.json();
    
    return apiOrders.map((order: any) => ({
      ...order,
      channel: 'online' as const,
      served: order.status === 'delivered',
      customerName: order.customer_name || order.email || 'Customer',
      items: order.items || [],
      deliveryAddress: order.delivery_address || 'Onsite / Walk-in',
    }));
  } catch (error) {
    console.error('Failed to fetch orders from API, using local storage:', error);
    return [...getOnlineOrders(), ...getOnsiteOrders()].sort(
      (a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime()
    );
  }
};

export const updateOrderStatus = async (orderId: string, status: string): Promise<boolean> => {
  try {
    await orderService.updateOrderStatus(orderId, status);
    return true;
  } catch (error) {
    console.error('Failed to update order status via API:', error);
    return false;
  }
};

export const getAllCustomers = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${API_URL}/orders/customers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return [];
  }
};

export const addOnsiteOrder = (data: {
  customerName: string;
  items: { name: string; quantity: number; price: number }[];
  paymentMethod: string;
}): AdminOrder => {
  const total = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const newOrder: AdminOrder = {
    id: `WI-${Date.now()}`,
    email: '',
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
        is_available: true,
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
    updateOnlineOrdersInStorage((orders) =>
      orders.map((o) => (o.id === orderId ? { ...o, status: 'delivered' as const } : o))
    );
  }
};

export const removeOrder = (orderId: string, channel: OrderChannel): void => {
  if (channel === 'onsite') {
    const orders = getOnsiteOrders().filter((o) => o.id !== orderId);
    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(orders));
  } else {
    updateOnlineOrdersInStorage((orders) => orders.filter((o) => o.id !== orderId));
  }
};