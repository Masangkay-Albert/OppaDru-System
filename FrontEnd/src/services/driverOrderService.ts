import { getOnlineOrders, type AdminOrder } from './adminOrderService';
import type { Order } from '../contexts/OrderContext';

export interface DriverOrder extends AdminOrder {
  phone?: string;
  deliveryType?: 'standard' | 'priority';
  scheduleDisplay?: string;
}

const getDriverStorageKeys = (): string[] => {
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
  const keys = getDriverStorageKeys();

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
      // Ignore invalid storage entries.
    }
  });
};

export const getAvailableDriverOrders = (): DriverOrder[] => {
  const allOrders = getOnlineOrders() as DriverOrder[]; 
  return allOrders.filter((o) => o.status === 'pending' || o.status === 'preparing');
};

export const getActiveDeliveries = (): DriverOrder[] => {
  const allOrders = getOnlineOrders() as DriverOrder[];
  
  return allOrders.filter((o) => o.status === 'on_the_way');
};

export const acceptOrder = (orderId: string): void => {

  updateOrderStatusInStorage(orderId, 'on_the_way');
};

export const completeDelivery = (orderId: string): void => {
  updateOrderStatusInStorage(orderId, 'delivered');
};

// NEW: Added to support the History tab in the Driver Dashboard
export const getDeliveredOrders = (): DriverOrder[] => {
  const allOrders = getOnlineOrders() as DriverOrder[];
  return allOrders.filter((o) => o.status === 'delivered');
};