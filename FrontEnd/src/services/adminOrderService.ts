import type { Order } from '../contexts/OrderContext';
import type { CartItem } from '../types/product.types';
import { getAccountDisplayName } from './adminAuthService';
import { orderService } from './orderService';
import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';

const ORDERS_KEY = 'orders';
const ONSITE_ORDERS_KEY = 'onsiteOrders';
const CACHE_TTL = 15_000;
let ordersCache: { expiresAt: number; promise: Promise<AdminOrder[]> } | null = null;
let customersCache: { expiresAt: number; promise: Promise<any[]> } | null = null;
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

export type AdminOrder = Omit<Order, 'timestamp'> & {
  channel: OrderChannel;
  customerName?: string;
  customer_name?: string;
  served?: boolean;
  order_number?: string;
  created_at?: string;
  timestamp?: string;
};

const isPendingGracePeriodOrder = (order: any): boolean => {
  const status = String(order?.status ?? '').trim().toLowerCase();
  if (status !== 'pending') return false;

  const rawValue = order?.timestamp || order?.created_at || order?.createdAt;
  const createdAt = rawValue ? new Date(rawValue) : null;

  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return true;
  }

  const elapsed = (Date.now() - createdAt.getTime()) / 1000;
  return elapsed <= 20;
};

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
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((order) => {
        if (isPendingGracePeriodOrder(order)) return;
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
  if (ordersCache && ordersCache.expiresAt > Date.now()) return ordersCache.promise;

  const request = (async () => {
   try {
    const response = await fetchWithAdminAuth(`${API_URL}/orders`);

    if (!response.ok) {
      throw new Error('Failed to fetch orders from API');
    }

    const apiOrders = await response.json();
    const safeApiOrders = Array.isArray(apiOrders) ? apiOrders : [];
    
    const onlineOrders: AdminOrder[] = safeApiOrders.map((order: any) => ({
      ...order,
      channel: order.channel === 'onsite' ? 'onsite' : 'online',
      served: order.status === 'delivered',
      customer_name: order.customer_name || order.user?.full_name || order.customerName || order.email || 'Customer',
      customerName: order.customer_name || order.user?.full_name || order.customerName || order.email || 'Customer',
      total: Number.isFinite(Number(order.total)) ? Number(order.total) : 0,
      items: Array.isArray(order.items) ? order.items.map((item: any) => ({
        ...item,
        product_price: Number.isFinite(Number(item.product_price)) ? Number(item.product_price) : 0,
        quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
      })) : [],
      deliveryAddress: order.delivery_address || 'Onsite / Walk-in',
      created_at: order.created_at || order.timestamp || null,
      timestamp: order.timestamp || order.created_at || null,
    }));

    return [...onlineOrders, ...getOnsiteOrders()].sort(
      (a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime()
    );
    } catch {
    return [...getOnlineOrders(), ...getOnsiteOrders()].sort(
      (a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime()
    );
   }
  })();

  ordersCache = { expiresAt: Date.now() + CACHE_TTL, promise: request };
  return request;
};

export const updateOrderStatus = async (orderId: string, status: string): Promise<boolean> => {
  try {
    await orderService.updateOrderStatus(orderId, status);
    return true;
  } catch {
    return false;
  }
};

export const getAllCustomers = async (): Promise<any[]> => {
  if (customersCache && customersCache.expiresAt > Date.now()) return customersCache.promise;

  const request = (async () => {
   try {
    const response = await fetchWithAdminAuth(`${API_URL}/orders/customers`);

    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    const result = await response.json();
    return Array.isArray(result?.data) ? result.data : [];
   } catch {
    return [];
   }
  })();

  customersCache = { expiresAt: Date.now() + CACHE_TTL, promise: request };
  return request;
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