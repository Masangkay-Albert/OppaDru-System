import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types/product.types';
import type { OrderStatus } from '../utils/constants';
import { useAuth } from './Authcontext';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import type { CreateOrderData } from '../services/orderService';

export interface Order {
  id: string;
  email: string;
  items: CartItem[];
  total: number;
  address: string;
  status: OrderStatus;
  paymentMethod: string;
  phone?: string;
  orderNumber?: string;
  userId?: string;
  timestamp: string;
  deliveryAddress?: string;
  coords?: { lat: number; lng: number };
  deliveryAddressCoords?: { lat: number; lng: number };
  eta?: number;
}

interface OrderContextType {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  placeOrder: (
    items: CartItem[],
    total: number,
    address: string,
    paymentMethod: string,
    phone?: string,
    deliveryAddressCoords?: { lat: number; lng: number }
  ) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  clearOrder: () => void;
  getOrderById: (orderId: string) => Order | undefined;
  fetchUserOrders: () => Promise<void>;
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
  const resolvedUser = user ?? authService.getUserFromStorage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const getOrdersKey = useCallback(() => {
    return resolvedUser?.id ? `orders_user_${resolvedUser.id}` : 'orders_guest';
  }, [resolvedUser]);
  
  const getCurrentOrderKey = useCallback(() => {
    return resolvedUser?.id ? `currentOrder_user_${resolvedUser.id}` : 'currentOrder_guest';
  }, [resolvedUser]);

  const fetchUserOrders = useCallback(async () => {
    if (!resolvedUser) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    try {
      const apiOrders = await orderService.getUserOrders();
      const mappedOrders: Order[] = apiOrders.map(apiOrder => ({
        id: apiOrder.id,
        email: apiOrder.email,
        items: apiOrder.items?.map((item: any) => ({
          id: item.product_id,
          name: item.product_name || item.product_id,
          price: Number(item.product_price),
          quantity: item.quantity,
          cartItemId: `${apiOrder.id}_${item.product_id}`,
          description: '',
          category: '',
          image: '',
          is_available: true,
          isAvailable: true,
          selectedAddons: item.selected_addons,
          specialInstructions: item.special_instructions,
        })) || [],
        total: Number(apiOrder.total),
        address: apiOrder.delivery_address,
        status: apiOrder.status as OrderStatus,
        paymentMethod: apiOrder.payment_method,
        phone: apiOrder.phone,
        orderNumber: apiOrder.order_number,
        userId: resolvedUser.id,
        timestamp: apiOrder.created_at || new Date().toISOString(),
        deliveryAddress: apiOrder.delivery_address,
        eta: 35,
      }));
      setOrders(mappedOrders);
      localStorage.setItem(getOrdersKey(), JSON.stringify(mappedOrders));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUser, getOrdersKey]);

  const loadOrders = useCallback(() => {
    if (!resolvedUser) {
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
        setOrders([]);
      }
    } else {
      fetchUserOrders();
    }

    if (savedCurrentOrder) {
      try {
        setCurrentOrder(JSON.parse(savedCurrentOrder));
      } catch {
        setCurrentOrder(null);
      }
    } else {
      setCurrentOrder(null);
    }
  }, [resolvedUser, getOrdersKey, getCurrentOrderKey, fetchUserOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const placeOrder = async (
    items: CartItem[],
    total: number,
    address: string,
    paymentMethod: string,
    phone?: string,
    deliveryAddressCoords?: { lat: number; lng: number }
  ): Promise<boolean> => {
    const activeUser = user ?? authService.getUserFromStorage();
    if (!activeUser) {
      return false;
    }

    setIsLoading(true);

    try {
      const validItems = items.filter(item => item.id);

      if (validItems.length === 0) {
        setIsLoading(false);
        return false;
      }

      const orderItems = validItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        product_price: Number(item.price),
        quantity: item.quantity,
        selected_addons: item.selectedAddons?.map(addon => ({
          id: addon.id,
          name: addon.name,
          price: Number(addon.price),
        })),
        special_instructions: item.specialInstructions,
      }));

      const data: CreateOrderData = {
        email: activeUser.email,
        items: orderItems,
        total,
        delivery_address: address,
        payment_method: paymentMethod as 'cash_on_delivery' | 'gcash' | 'credit_card',
        phone: phone || '',
      };

      const apiOrder = await orderService.createOrder(data);

      const newOrder: Order = {
        id: apiOrder.id,
        email: apiOrder.email,
        items: validItems,
        total: Number(apiOrder.total),
        address: apiOrder.delivery_address,
        status: apiOrder.status as OrderStatus,
        paymentMethod: apiOrder.payment_method,
        phone: apiOrder.phone,
        orderNumber: apiOrder.order_number,
        userId: activeUser.id,
        timestamp: apiOrder.created_at || new Date().toISOString(),
        deliveryAddress: apiOrder.delivery_address,
        coords: deliveryAddressCoords,
        deliveryAddressCoords,
        eta: 35,
      };

      const updatedOrders = [...orders, newOrder];
      setOrders(updatedOrders);
      setCurrentOrder(newOrder);

      localStorage.setItem(getCurrentOrderKey(), JSON.stringify(newOrder));
      localStorage.setItem(getOrdersKey(), JSON.stringify(updatedOrders));

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Failed to place order:', error);
      setIsLoading(false);
      return false;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, status);

      setOrders(prev => {
        const updated = prev.map(order =>
          order.id === orderId ? { ...order, status } : order
        );
        localStorage.setItem(getOrdersKey(), JSON.stringify(updated));
        return updated;
      });

      if (currentOrder?.id === orderId) {
        const updatedOrder = { ...currentOrder, status };
        setCurrentOrder(updatedOrder);
        localStorage.setItem(getCurrentOrderKey(), JSON.stringify(updatedOrder));
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
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
      isLoading,
      placeOrder,
      updateOrderStatus,
      clearOrder,
      getOrderById,
      fetchUserOrders,
    }}>
      {children}
    </OrderContext.Provider>
  );
};