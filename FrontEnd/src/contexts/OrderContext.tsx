// src/contexts/OrderContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types/product.types';
import { ORDER_STATUS, type OrderStatus } from '../utils/constants';
import { OPPA_DRU_STORE } from '../utils/constants';
import { useAuth } from './Authcontext';

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  address: string;
  coords: { lat: number; lng: number };
  status: OrderStatus;
  timestamp: string;
  paymentMethod: string;
  paymentReference?: string;
  eta?: number;
  currentRouteIndex?: number;
  deliveryAddress: string;
  deliveryAddressCoords: { lat: number; lng: number };
  driverPosition?: { lat: number; lng: number };
  createdAt?: string;
  deliveryFee?: number;
  serviceFee?: number;
}

interface OrderContextType {
  orders: Order[];
  currentOrder: Order | null;
  placeOrder: (
    items: CartItem[],
    total: number,
    address: string,
    coords: { lat: number; lng: number },
    paymentMethod: string,
    paymentReference?: string
  ) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateDriverPosition: (orderId: string, position: { lat: number; lng: number }) => void;
  clearOrder: () => void;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
};

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Bawat user may sariling orders key, gaya ng ginawa sa CartContext.
  const getOrdersKey = useCallback(() => {
    if (user?.id) {
      return `orders_user_${user.id}`;
    }
    return 'orders_guest';
  }, [user]);

  const getCurrentOrderKey = useCallback(() => {
    if (user?.id) {
      return `currentOrder_user_${user.id}`;
    }
    return 'currentOrder_guest';
  }, [user]);

  const loadOrders = useCallback(() => {
    if (!user) {
      setOrders([]);
      setCurrentOrder(null);
      return;
    }

    const savedOrders = localStorage.getItem(getOrdersKey());
    const savedCurrentOrder = localStorage.getItem(getCurrentOrderKey());

    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch {
        console.error('Failed to parse orders');
        setOrders([]);
      }
    } else {
      setOrders([]);
    }

    if (savedCurrentOrder) {
      try {
        setCurrentOrder(JSON.parse(savedCurrentOrder));
      } catch {
        console.error('Failed to parse current order');
        setCurrentOrder(null);
      }
    } else {
      setCurrentOrder(null);
    }
  }, [user, getOrdersKey, getCurrentOrderKey]);

  // Reload orders tuwing magpapalit ng naka-login na user (login/logout).
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const placeOrder = (
    items: CartItem[],
    total: number,
    address: string,
    coords: { lat: number; lng: number },
    paymentMethod: string,
    paymentReference?: string
  ) => {
    if (!user) {
      console.error('Cannot place order: no user logged in');
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      userId: user.id,
      items,
      total,
      address,
      coords,
      status: ORDER_STATUS.PENDING,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentReference,
      eta: 35,
      currentRouteIndex: 0,
      deliveryAddress: address,
      deliveryAddressCoords: coords,
      deliveryFee: 49,
      serviceFee: 29,
      driverPosition: {
        lat: OPPA_DRU_STORE.lat,
        lng: OPPA_DRU_STORE.lng
      }
    };

    const updatedOrders = [...orders, newOrder];
    setOrders(updatedOrders);
    setCurrentOrder(newOrder);

    localStorage.setItem(getCurrentOrderKey(), JSON.stringify(newOrder));
    localStorage.setItem(getOrdersKey(), JSON.stringify(updatedOrders));
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => {
      const updated = prev.map(order =>
        order.id === orderId ? { ...order, status } : order
      );
      localStorage.setItem(getOrdersKey(), JSON.stringify(updated));
      return updated;
    });

    if (currentOrder?.id === orderId) {
      const updatedOrder: Order = {
        ...currentOrder,
        status
      };
      setCurrentOrder(updatedOrder);
      localStorage.setItem(getCurrentOrderKey(), JSON.stringify(updatedOrder));
    }
  };

  const updateDriverPosition = (orderId: string, position: { lat: number; lng: number }) => {
    setOrders(prev => {
      const updated = prev.map(order =>
        order.id === orderId ? { ...order, driverPosition: position } : order
      );
      localStorage.setItem(getOrdersKey(), JSON.stringify(updated));
      return updated;
    });

    if (currentOrder?.id === orderId) {
      const updatedOrder: Order = {
        ...currentOrder,
        driverPosition: position
      };
      setCurrentOrder(updatedOrder);
      localStorage.setItem(getCurrentOrderKey(), JSON.stringify(updatedOrder));
    }
  };

  const clearOrder = () => {
    setCurrentOrder(null);
    localStorage.removeItem(getCurrentOrderKey());
  };

  const getOrderById = (orderId: string): Order | undefined => {
    return orders.find(order => order.id === orderId);
  };

  return (
    <OrderContext.Provider value={{
      orders,
      currentOrder,
      placeOrder,
      updateOrderStatus,
      updateDriverPosition,
      clearOrder,
      getOrderById
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export type { OrderContextType };