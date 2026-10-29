import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  statusHistory?: Array<{ status: string; createdAt?: string | null }>;
  paymentMethod: string;
  payment_status?: string;
  phone?: string;
  orderNumber?: string;
  userId?: string;
  timestamp: string;
  graceStartedAt?: number;
  deliveryAddress?: string;
  coords?: { lat: number; lng: number };
  deliveryAddressCoords?: { lat: number; lng: number };
  branchId?: string | null;
  branch?: { id?: string; name?: string; latitude?: number; longitude?: number; address?: string } | null;
  branch_name?: string | null;
  branchName?: string;
  branchCoords?: { lat: number; lng: number };
  branchAddress?: string;
  eta?: number;
  deliveryType?: 'standard' | 'priority' | 'scheduled';
  deliveryFee?: number;
  serviceFee?: number;
  priorityFee?: number;
  vat?: number;
  discountType?: 'PWD' | 'Senior Citizen' | null;
  discountRate?: number;
  discountAmount?: number;
  discountStatus?: string;
  discountProofImage?: string | null;
  scheduledAt?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduleDisplay?: string | null;
  scheduleWindow?: string | null;
  driverId?: string | null;
  driver_id?: string | null;
  driver?: {
    id?: string;
    name?: string;
    phone?: string;
    vehicle_type?: string;
    vehicleType?: string;
  } | null;
}

interface OrderContextType {
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  refreshOrders: (showLoading?: boolean) => Promise<void>;
  placeOrder: (
    items: CartItem[],
    total: number,
    address: string,
    paymentMethod: string,
    phone?: string,
    deliveryAddressCoords?: { lat: number; lng: number },
    paymentReference?: string,
    deliveryType?: 'standard' | 'priority' | 'scheduled',
    voucherDiscount?: number,
    _discountRate?: number,
    scheduledAt?: string | null,
    scheduledDate?: string | null,
    scheduledTime?: string | null,
    scheduleDisplay?: string | null,
    scheduleWindow?: string | null,
    discountType?: 'PWD' | 'Senior Citizen' | null,
    discountProof?: File | null,
    franchiseId?: string | null,
    promoId?: string | null,
    promoCode?: string | null,
  ) => Promise<string | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  clearOrder: () => void;
  getOrderById: (orderId: string) => Order | undefined;
  fetchUserOrders: (showLoading?: boolean) => Promise<void>;
  refreshOrderById: (orderId: string, signal?: AbortSignal) => Promise<Order>;
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
  const userId = resolvedUser?.id ? String(resolvedUser.id) : null;
  const userEmail = resolvedUser?.email || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ordersRef = useRef<Order[]>([]);
  const currentOrderRef = useRef<Order | null>(null);
  const cacheOwnerIdRef = useRef<string | null>(null);
  const storageKeys = useCallback(() => userId && authService.getToken() ? {
    orders: `oppa:orders:v1:${userId}`,
    current: `oppa:current-order:v1:${userId}`,
    tracking: `oppa:tracking-order:v1:${userId}`,
  } : null, [userId]);

  const persistOrders = useCallback((nextOrders: Order[]) => {
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    const keys = storageKeys();
    if (keys) localStorage.setItem(keys.orders, JSON.stringify(nextOrders));
  }, [storageKeys]);

  const persistCurrentOrder = useCallback((nextOrder: Order | null) => {
    currentOrderRef.current = nextOrder;
    setCurrentOrder(nextOrder);
    const keys = storageKeys();
    if (keys && nextOrder) {
      localStorage.setItem(keys.current, JSON.stringify(nextOrder));
      localStorage.setItem(keys.tracking, JSON.stringify(nextOrder));
    } else if (keys) {
      localStorage.removeItem(keys.current);
      localStorage.removeItem(keys.tracking);
    }
  }, [storageKeys]);

  const mapApiOrder = useCallback((apiOrder: any): Order => {
    const productSubtotal = (apiOrder.items || []).reduce((sum: number, item: any) => {
      const addonTotal = (item.selected_addons || []).reduce((addonSum: number, addon: any) => addonSum + Number(addon.price || 0) * Number(addon.quantity || 1), 0);
      return sum + ((Number(item.product_price || 0) + addonTotal) * Number(item.quantity || 1));
    }, 0);
    const deliveryFee = Number(apiOrder.delivery_fee || 0) > 0
      ? Number(apiOrder.delivery_fee || 0)
      : Math.max(0, Number(apiOrder.total || 0) - productSubtotal - Number(apiOrder.service_fee || 0) - Number(apiOrder.vat || 0) - Number(apiOrder.priority_fee || 0));
    const branch = apiOrder.branch || apiOrder.franchise || null;
    const latitude = branch?.latitude == null ? NaN : Number(branch.latitude);
    const longitude = branch?.longitude == null ? NaN : Number(branch.longitude);
    const rawDeliveryCoords = apiOrder.delivery_coordinates
      || (apiOrder.delivery_lat != null && apiOrder.delivery_lng != null
        ? { lat: apiOrder.delivery_lat, lng: apiOrder.delivery_lng }
        : null);
    const deliveryLat = rawDeliveryCoords?.lat ?? rawDeliveryCoords?.latitude;
    const deliveryLng = rawDeliveryCoords?.lng ?? rawDeliveryCoords?.longitude;
    const deliveryCoords = deliveryLat != null && deliveryLng != null
      && Number.isFinite(Number(deliveryLat)) && Number.isFinite(Number(deliveryLng))
      ? { lat: Number(deliveryLat), lng: Number(deliveryLng) }
      : undefined;
    const createdAt = apiOrder.created_at || apiOrder.timestamp || new Date().toISOString();

    return {
      id: String(apiOrder.id),
      email: apiOrder.email || userEmail,
      items: apiOrder.items?.map((item: any) => ({
        id: item.product_id,
        name: item.product_name || item.product_id,
        price: Number(item.product_price || 0),
        quantity: Number(item.quantity || 1),
        cartItemId: `${apiOrder.id}_${item.product_id}`,
        description: '', category: '', image: '', is_available: true, isAvailable: true,
        selectedAddons: item.selected_addons,
        specialInstructions: item.special_instructions,
      })) || [],
      total: Number(apiOrder.total),
      address: apiOrder.delivery_address || '',
      status: apiOrder.status as OrderStatus,
      statusHistory: Array.isArray(apiOrder.status_history) ? apiOrder.status_history.map((entry: any) => ({
        status: String(entry.status || ''),
        createdAt: entry.created_at || entry.createdAt || null,
      })) : [],
      paymentMethod: apiOrder.payment_method || '',
      payment_status: apiOrder.payment_status,
      phone: apiOrder.phone,
      orderNumber: apiOrder.order_number,
      userId: userId || undefined,
      timestamp: createdAt,
      graceStartedAt: new Date(createdAt).getTime(),
      deliveryAddress: apiOrder.delivery_address,
      deliveryAddressCoords: deliveryCoords,
      branchId: apiOrder.branch_id || apiOrder.franchise_id || null,
      branch: branch,
      branch_name: apiOrder.branch_name || branch?.name || null,
      branchName: apiOrder.branch_name || branch?.name,
      branchCoords: Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : undefined,
      branchAddress: branch?.address,
      coords: deliveryCoords,
      eta: Number.isFinite(Number(apiOrder.eta)) ? Number(apiOrder.eta) : 35,
      deliveryType: (apiOrder.delivery_type as 'standard' | 'priority' | 'scheduled') || 'standard',
      deliveryFee,
      serviceFee: Number(apiOrder.service_fee || 0),
      priorityFee: Number(apiOrder.priority_fee || 0),
      vat: Number(apiOrder.vat || 0),
      discountType: apiOrder.discount_type || null,
      discountRate: Number(apiOrder.discount_rate || 0),
      discountAmount: Number(apiOrder.discount_amount || 0),
      discountStatus: apiOrder.discount_status || 'not_requested',
      discountProofImage: apiOrder.discount_proof_image || null,
      scheduledAt: apiOrder.scheduled_at || null,
      scheduledDate: apiOrder.scheduled_date || null,
      scheduledTime: apiOrder.scheduled_time || apiOrder.schedule_window || null,
      scheduleDisplay: apiOrder.schedule_display || null,
      driverId: apiOrder.driver_id || apiOrder.driver?.id || null,
      driver: apiOrder.driver ? {
        id: String(apiOrder.driver.id || ''),
        name: apiOrder.driver.name || 'Assigned Driver',
        phone: apiOrder.driver.phone || '',
        vehicleType: apiOrder.driver.vehicleType || apiOrder.driver.vehicle_type || 'Motorcycle',
        vehicle_type: apiOrder.driver.vehicle_type || apiOrder.driver.vehicleType || 'Motorcycle',
      } : null,
      scheduleWindow: apiOrder.schedule_window || null,
    };
  }, [userEmail, userId]);

  const mergeOrderLists = (existing: Order[], incoming: Order[]) => {
    const merged = new Map(existing.map((order) => [order.id, order]));
    incoming.forEach((order) => {
      const cached = merged.get(order.id);
      merged.set(order.id, {
        ...cached,
        ...order,
        items: order.items.length ? order.items : cached?.items || [],
        statusHistory: order.statusHistory?.length ? order.statusHistory : cached?.statusHistory || [],
        branch: order.branch || cached?.branch,
        branchId: order.branchId || cached?.branchId,
        branchName: order.branchName || cached?.branchName,
        branchCoords: order.branchCoords || cached?.branchCoords,
        branchAddress: order.branchAddress || cached?.branchAddress,
        deliveryAddressCoords: order.deliveryAddressCoords || cached?.deliveryAddressCoords,
        coords: order.coords || cached?.coords,
      } as Order);
    });
    return [...merged.values()].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  };

  const isFinalStatus = (status: unknown) => ['delivered', 'cancelled', 'completed', 'failed'].includes(String(status || '').trim().toLowerCase());
  const latestOrder = (list: Order[]) => [...list].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0] || null;
  const latestActiveOrder = (list: Order[]) => latestOrder(list.filter((order) => !isFinalStatus(order.status)));

  const loadUserCache = useCallback((): { orders: Order[]; current: Order | null } => {
    if (!userEmail || !userId || !authService.getToken()) return { orders: [], current: null };
    const keys = storageKeys();
    if (!keys) return { orders: [], current: null };
    const ownedByCurrentUser = (order: any) => order && (
      String(order.userId || order.user_id || '') === userId
      || String(order.email || '').toLowerCase() === userEmail.toLowerCase()
    );
    const readJson = <T,>(key: string): T | null => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
    };
    const versionedOrders = readJson<Order[]>(keys.orders) || [];
    const legacyOrders = readJson<Order[]>(`orders_user_${userId}`) || [];
    const legacyCurrent = readJson<Order>(`currentOrder_user_${userId}`);
    const legacyTracking = readJson<Order>('active_order_tracking');
    const cacheOrders = mergeOrderLists(
      versionedOrders.filter(ownedByCurrentUser),
      legacyOrders.filter(ownedByCurrentUser),
    );
    [legacyCurrent, legacyTracking].forEach((order) => {
      if (ownedByCurrentUser(order) && !cacheOrders.some((saved) => saved.id === order!.id)) cacheOrders.push(order!);
    });
    const savedCurrent = readJson<Order>(keys.current) || readJson<Order>(keys.tracking) || legacyCurrent || legacyTracking;
    const current = ownedByCurrentUser(savedCurrent) ? savedCurrent! : latestActiveOrder(cacheOrders) || latestOrder(cacheOrders);
    if (cacheOrders.length) localStorage.setItem(keys.orders, JSON.stringify(cacheOrders));
    if (current) {
      localStorage.setItem(keys.current, JSON.stringify(current));
      localStorage.setItem(keys.tracking, JSON.stringify(current));
    }
    return { orders: cacheOrders, current };
  }, [storageKeys, userEmail, userId]);

  const fetchUserOrders = useCallback(async (showLoading = true) => {
    if (!userId || !userEmail || !authService.getToken()) return;

    if (showLoading) setIsLoading(true);
    try {
      const apiOrders = await orderService.getUserOrders();
      if (authService.getUserFromStorage()?.id !== userId) return;
      const mappedOrders = apiOrders.map(mapApiOrder);
      const apiOrderIds = new Set(mappedOrders.map((order) => order.id));
      const cachedOrders = ordersRef.current.filter((order) => apiOrderIds.has(order.id));
      const mergedOrders = mergeOrderLists(cachedOrders, mappedOrders);
      persistOrders(mergedOrders);
      const active = latestActiveOrder(mergedOrders);
      const selectedCurrent = active
        || (currentOrderRef.current && mergedOrders.find((order) => order.id === currentOrderRef.current?.id))
        || latestOrder(mergedOrders);
      persistCurrentOrder(selectedCurrent);
    } catch (error) {
      if (error instanceof Error && error.message.includes('(401)')) {
        console.warn('Your customer session is no longer valid. Sign in again to refresh your order history.');
      } else {
        console.error('Failed to fetch orders:', error);
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [userId, userEmail, mapApiOrder, persistCurrentOrder, persistOrders]);

  useEffect(() => {
    if (!userId || !authService.getToken()) {
      cacheOwnerIdRef.current = null;
      ordersRef.current = [];
      currentOrderRef.current = null;
      setOrders([]);
      setCurrentOrder(null);
      return;
    }
    const cached = loadUserCache();
    cacheOwnerIdRef.current = userId;
    ordersRef.current = [];
    currentOrderRef.current = cached.current;
    setOrders([]);
    setCurrentOrder(cached.current);
    void fetchUserOrders(true);
  }, [userId, userEmail, loadUserCache, fetchUserOrders]);

  const refreshOrderById = useCallback(async (orderId: string, signal?: AbortSignal): Promise<Order> => {
    if (!userId || !authService.getToken()) throw new Error('Sign in to load this order.');
    const apiOrder = await orderService.getUserOrder(orderId, signal);
    if (authService.getUserFromStorage()?.id !== userId) throw new Error('The signed-in user changed.');
    const mapped = mapApiOrder(apiOrder);
    const nextOrders = mergeOrderLists(ordersRef.current, [mapped]);
    persistOrders(nextOrders);
    persistCurrentOrder(mapped);
    return mapped;
  }, [userId, mapApiOrder, persistOrders, persistCurrentOrder]);

  const placeOrder = async (
    items: CartItem[],
    total: number,
    address: string,
    paymentMethod: string,
    phone?: string,
    deliveryAddressCoords?: { lat: number; lng: number },
    paymentReference?: string,
    deliveryType: 'standard' | 'priority' | 'scheduled' = 'standard',
    voucherDiscount: number = 0,
    discountRate: number = 0,
    scheduledAt: string | null = null,
    scheduledDate: string | null = null,
    scheduledTime: string | null = null,
    scheduleDisplay: string | null = null,
    scheduleWindow: string | null = null,
    discountType?: 'PWD' | 'Senior Citizen' | null,
    discountProof?: File | null,
    franchiseId?: string | null,
    promoId?: string | null,
    promoCode?: string | null,
  ): Promise<string | null> => {
    const token = authService.getToken();
    const activeUser = token ? user ?? authService.getUserFromStorage() : null;
    if (!activeUser || !token) {
      throw new Error('Sign in to place your order.');
    }

    setIsLoading(true);

    try {
      const validItems = items.filter(item => item.id);

      if (validItems.length === 0) {
        setIsLoading(false);
        return null;
      }

      const orderItems = validItems.map(item => ({
        product_id: item.id,
        product_name: item.selectedSize ? `${item.name} (${item.selectedSize})` : item.name,
        product_price: Number(item.price),
        quantity: item.quantity,
        selected_size: item.selectedSize,
        selected_addons: item.selectedAddons?.map(addon => ({
          id: addon.id,
          name: addon.name,
          price: Number(addon.price),
          quantity: addon.quantity || 1,
        })),
        special_instructions: [
          item.specialInstructions,
          item.selectedSize ? `Size: ${item.selectedSize}` : null,
        ].filter(Boolean).join(' | ') || undefined,
      }));

      const data: CreateOrderData = {
        email: activeUser.email,
        franchise_id: franchiseId || undefined,
        items: orderItems,
        total,
        delivery_address: address,
        payment_method: paymentMethod as 'cash_on_delivery' | 'gcash' | 'credit_card',
        delivery_type: deliveryType,
        phone: phone || '',
        delivery_coordinates: deliveryAddressCoords,
        payment_reference: paymentReference,
        voucher_discount: voucherDiscount,
        promo_id: promoId || undefined,
        promo_code: promoCode || undefined,
        promo_discount: voucherDiscount,
        discount_rate: discountRate,
        discount_type: discountType || undefined,
        proof_image: discountProof || undefined,
        scheduled_at: deliveryType === 'scheduled' ? (scheduledAt || new Date().toISOString()) : null,
        scheduled_date: deliveryType === 'scheduled' ? (scheduledDate || null) : null,
        scheduled_time: deliveryType === 'scheduled' ? (scheduledTime || scheduleWindow || null) : null,
        schedule_display: deliveryType === 'scheduled' ? (scheduleDisplay || null) : null,
        schedule_window: deliveryType === 'scheduled' ? (scheduleWindow || scheduledTime || null) : null,
      };

      const apiOrder = await orderService.createOrder(data);
      const mappedOrder = mapApiOrder(apiOrder);
      const newOrder: Order = {
        ...mappedOrder,
        items: mappedOrder.items.length ? mappedOrder.items : validItems,
        deliveryAddressCoords: mappedOrder.deliveryAddressCoords || deliveryAddressCoords,
        coords: mappedOrder.deliveryAddressCoords || deliveryAddressCoords,
        discountType: mappedOrder.discountType || discountType || null,
      };
      persistOrders(mergeOrderLists(ordersRef.current, [newOrder]));
      persistCurrentOrder(newOrder);

      setIsLoading(false);
      return newOrder.id;
    } catch (error) {
      console.error('Failed to place order:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, status);

      const updated = ordersRef.current.map(order => order.id === orderId ? { ...order, status } : order);
      persistOrders(updated);
      const updatedCurrent = currentOrderRef.current?.id === orderId
        ? { ...currentOrderRef.current, status }
        : currentOrderRef.current;
      if (updatedCurrent) persistCurrentOrder(updatedCurrent);
      void fetchUserOrders(false);
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const clearOrder = () => {
    currentOrderRef.current = null;
    setCurrentOrder(null);
  };

  const visibleOrders = cacheOwnerIdRef.current === userId ? orders : [];
  const visibleCurrentOrder = cacheOwnerIdRef.current === userId ? currentOrder : null;
  const getOrderById = (orderId: string): Order | undefined => visibleOrders.find(order => order.id === orderId);

  return (
    <OrderContext.Provider value={{
      orders: visibleOrders,
      currentOrder: visibleCurrentOrder,
      isLoading,
      refreshOrders: fetchUserOrders,
      placeOrder,
      updateOrderStatus,
      clearOrder,
      getOrderById,
      fetchUserOrders,
      refreshOrderById,
    }}>
      {children}
    </OrderContext.Provider>
  );
};
