// src/contexts/OrderContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types/product.types';
import { ORDER_STATUS, type OrderStatus } from '../utils/constants';
import { OPPA_DRU_STORE } from '../utils/constants';

export interface Order {
  id: string;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(() => {
    const savedOrders = localStorage.getItem('orders');
    const savedCurrentOrder = localStorage.getItem('currentOrder');
    
    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch {
        console.error('Failed to parse orders');
      }
    }
    
    if (savedCurrentOrder) {
      try {
        setCurrentOrder(JSON.parse(savedCurrentOrder));
      } catch {
        console.error('Failed to parse current order');
      }
    }
  }, []);

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
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
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

    setOrders(prev => [...prev, newOrder]);
    setCurrentOrder(newOrder);

    localStorage.setItem('currentOrder', JSON.stringify(newOrder));
    localStorage.setItem('orders', JSON.stringify([...orders, newOrder]));
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, status } : order
      )
    );
    
    if (currentOrder?.id === orderId) {
      const updatedOrder: Order = {
        ...currentOrder,
        status
      };
      setCurrentOrder(updatedOrder);
      localStorage.setItem('currentOrder', JSON.stringify(updatedOrder));
    }
  };

  const updateDriverPosition = (orderId: string, position: { lat: number; lng: number }) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, driverPosition: position } : order
      )
    );
    
    if (currentOrder?.id === orderId) {
      const updatedOrder: Order = {
        ...currentOrder,
        driverPosition: position
      };
      setCurrentOrder(updatedOrder);
      localStorage.setItem('currentOrder', JSON.stringify(updatedOrder));
    }
  };

  const clearOrder = () => {
    setCurrentOrder(null);
    localStorage.removeItem('currentOrder');
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