import { getOnlineOrders, type AdminOrder } from './adminOrderService';
import type { Order } from '../contexts/OrderContext';

export interface KitchenOrder extends AdminOrder {
  deliveryType?: 'standard' | 'priority';
  scheduleDisplay?: string;
}

const getKitchenStorageKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key === 'orders' || key === 'orders_guest' || key.startsWith('orders_user_')) {
      keys.push(key);
    }
  }
  return keys;
};

const updateOrderStatusInStorage = (orderId: string, newStatus: Order['status']): void => {
  const keys = getKitchenStorageKeys();
  keys.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const orders: Order[] = JSON.parse(raw);
      let wasUpdated = false;
      const updatedOrders = orders.map((o) => {
        if (o.id === orderId) {
          wasUpdated = true;
          return { ...o, status: newStatus };
        }
        return o;
      });
      if (wasUpdated) {
        localStorage.setItem(key, JSON.stringify(updatedOrders));
      }
    } catch {
      // Ignore invalid JSON
    }
  });
};

export const getPendingOrders = (): KitchenOrder[] => {
  const allOrders = getOnlineOrders() as KitchenOrder[]; 
  return allOrders.filter((o) => o.status === 'pending');
};

export const getPreparingOrders = (): KitchenOrder[] => {
  const allOrders = getOnlineOrders() as KitchenOrder[];
  return allOrders.filter((o) => o.status === 'preparing');
};

export const getKitchenHistory = (): KitchenOrder[] => {
  const allOrders = getOnlineOrders() as KitchenOrder[];
  return allOrders.filter((o) => o.status === 'ready' || o.status === 'on_the_way' || o.status === 'delivered');
};

export const startPreparing = (orderId: string): void => {
  updateOrderStatusInStorage(orderId, 'preparing');
};

export const finishPreparing = (orderId: string): void => {
  updateOrderStatusInStorage(orderId, 'ready');
};
