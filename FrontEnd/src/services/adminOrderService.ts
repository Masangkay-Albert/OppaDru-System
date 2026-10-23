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

export const isRevenueOrder = (order: Pick<AdminOrder, 'status' | 'payment_status' | 'payment_method' | 'paymentMethod' | 'channel'>): boolean => {
  const status = String(order.status || '').trim().toLowerCase();
  const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const paymentMethod = String(order.payment_method || order.paymentMethod || '').trim().toLowerCase();

  if (['cancelled', 'failed'].includes(status) || ['failed', 'cancelled', 'expired'].includes(paymentStatus)) {
    return false;
  }

  return paymentStatus === 'paid'
    || (paymentMethod === 'cash_on_delivery' && status === 'delivered' && ['pending', 'unpaid', ''].includes(paymentStatus))
    || (order.channel === 'onsite' && paymentStatus === '');
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

export type AdminOrderItem = Partial<CartItem> & {
  name?: string;
  product_name?: string;
  price?: number;
  product_price?: number;
  quantity?: number;
  selected_addons?: Array<{ id: string; name: string; price: number; quantity?: number }>;
};

export type AdminOrder = Omit<Order, 'timestamp' | 'items'> & {
  items: AdminOrderItem[];
  channel: OrderChannel;
  customerName?: string;
  customer_name?: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_status?: string;
  payment_reference?: string | null;
  paymentReference?: string | null;
  served?: boolean;
  order_number?: string;
  delivery_proof_image_url?: string | null;
  delivery_proof_uploaded_at?: string | null;
  delivery_confirmed_at?: string | null;
  created_at?: string;
  timestamp?: string;
  diningOption?: 'dine_in' | 'takeout';
  notes?: string;
  cashTendered?: number;
  changeDue?: number;
  promo_id?: string | null;
  promo_code?: string | null;
  promo_discount?: number;
  cashierEmail?: string;
  delivery_type?: string;
  scheduled_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  schedule_display?: string | null;
};

const getOrderChannel = (order: any): OrderChannel => {
  const channel = String(order?.channel || '').trim().toLowerCase();
  if (channel === 'onsite' || channel === 'online') return channel;

  const deliveryType = String(order?.delivery_type || order?.deliveryType || '').trim().toLowerCase();
  const calculationMethod = String(order?.delivery_calculation_method || '').trim().toLowerCase();
  const address = String(order?.delivery_address || order?.deliveryAddress || order?.address || '').trim().toLowerCase();
  const email = String(order?.email || '').trim().toLowerCase();

  return deliveryType === 'onsite'
    || calculationMethod === 'onsite'
    || address.startsWith('onsite')
    || email.startsWith('cashier')
    || email.startsWith('onsite')
    ? 'onsite'
    : 'online';
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
    channel: getOrderChannel(o),
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

export const getAllOrders = async (forceRefresh = false): Promise<AdminOrder[]> => {
  if (!forceRefresh && ordersCache && ordersCache.expiresAt > Date.now()) return ordersCache.promise;

  const request = (async () => {
   try {
    const response = await fetchWithAdminAuth(`${API_URL}/orders`);

    if (!response.ok) {
      throw new Error('Failed to fetch orders from API');
    }

    const apiOrders = await response.json();
    const safeApiOrders = Array.isArray(apiOrders) ? apiOrders : [];
    
    const onlineOrders: AdminOrder[] = safeApiOrders.map((order: any) => {
      const paymentMethodValue = order.payment_method || order.paymentMethod || 'cash_on_delivery';

      return {
        ...order,
        channel: getOrderChannel(order),
        served: order.status === 'delivered',
        customer_name: order.customer_name || order.user?.full_name || order.customerName || order.email || 'Customer',
        customerName: order.customer_name || order.user?.full_name || order.customerName || order.email || 'Customer',
        branchId: order.branch_id || order.branchId || order.franchise_id || null,
        branchName: order.branch_name || order.branch?.name || order.franchise?.name || (order.branch_id || order.franchise_id ? null : 'Main System'),
        payment_method: paymentMethodValue,
        paymentMethod: paymentMethodValue,
        total: Number.isFinite(Number(order.total)) ? Number(order.total) : 0,
        items: Array.isArray(order.items) ? order.items.map((item: any) => ({
          ...item,
          product_price: Number.isFinite(Number(item.product_price)) ? Number(item.product_price) : 0,
          quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
        })) : [],
        deliveryAddress: order.delivery_address || 'Onsite / Walk-in',
        created_at: order.created_at || order.timestamp || null,
        timestamp: order.timestamp || order.created_at || null,
      };
    });

    const getSortTimestamp = (order: { created_at?: string | null; timestamp?: string | null }) => {
      const value = order.created_at || order.timestamp || '1970-01-01T00:00:00.000Z';
      return new Date(value).getTime();
    };

    return onlineOrders.sort(
      (a, b) => getSortTimestamp(b) - getSortTimestamp(a)
    );
    } catch {
    const getSortTimestamp = (order: { created_at?: string | null; timestamp?: string | null }) => {
      const value = order.created_at || order.timestamp || '1970-01-01T00:00:00.000Z';
      return new Date(value).getTime();
    };

    const deduplicatedOrders = new Map<string, AdminOrder>();
    [...getOnlineOrders(), ...getOnsiteOrders()].forEach((order) => deduplicatedOrders.set(order.id, order));
    return [...deduplicatedOrders.values()].sort(
      (a, b) => getSortTimestamp(b) - getSortTimestamp(a)
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
    const response = await fetchWithAdminAuth(`${API_URL}/orders/customers`);

    if (!response.ok) {
      throw new Error(`Failed to fetch customers (${response.status}).`);
    }

    const result = await response.json();
    return Array.isArray(result?.data) ? result.data : [];
  })();

  customersCache = { expiresAt: Date.now() + CACHE_TTL, promise: request };
  return request.catch((error: unknown) => {
    if (customersCache?.promise === request) customersCache = null;
    throw error;
  });
};

export interface OnsiteOrderData {
  customerName?: string;
  cashierEmail?: string;
  email?: string;
  items: (CartItem | {
    id?: string;
    cartItemId?: string;
    name: string;
    quantity: number;
    price: number;
    selectedAddons?: Array<{ id: string; name: string; price: number }>;
    specialInstructions?: string;
    selectedSize?: string;
    category?: any;
    image?: string;
    [key: string]: any;
  })[];
  paymentMethod: string;
  paymentReference?: string;
  diningOption?: 'dine_in' | 'takeout';
  notes?: string;
  phone?: string;
  discountType?: 'PWD' | 'Senior Citizen' | null;
  discountRate?: number;
  discountAmount?: number;
  discountIdNumber?: string;
  promoId?: string | null;
  promoCode?: string | null;
  promoDiscount?: number;
  cashTendered?: number;
  changeDue?: number;
  subtotal?: number;
  total?: number;
  vat?: number;
}

interface PosOnsiteOrderResponse {
  id: string;
  orderNumber?: string;
  order_number?: string;
  email?: string;
  user_id?: string | null;
  total: number | string;
  vat?: number | string | null;
  discount_amount?: number | string | null;
  status?: Order['status'];
  created_at?: string;
  payment_reference?: string;
  promo_code?: string | null;
  promo_discount?: number | string | null;
}

export const addOnsiteOrder = async (data: OnsiteOrderData): Promise<AdminOrder> => {
  const getCashierEmail = (): string => {
    try {
      const raw = sessionStorage.getItem('employee_auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email && typeof parsed.email === 'string' && parsed.email.trim()) {
          return parsed.email.trim();
        }
      }
    } catch {
      // ignore
    }
    return 'cashier@oppadru.ph';
  };

  const cashierEmail = data.cashierEmail || data.email || getCashierEmail();

  const itemsPayload = data.items.map((i) => ({
    product_id: i.id || (i as any).product_id || '',
    quantity: Number(i.quantity || 1),
    selected_size: i.selectedSize || (i as any).selected_size || undefined,
    selected_addons: (i.selectedAddons || (i as any).selected_addons || []).map((a: any) => ({
      id: a.id,
      quantity: Number(a.quantity || 1),
    })),
    special_instructions: i.specialInstructions || (i as any).special_instructions || undefined,
  }));

  const payload = {
    customer_name: data.customerName?.trim() || 'Walk-in Customer',
    phone: data.phone?.trim() || undefined,
    dining_option: data.diningOption || 'takeout',
    notes: data.notes?.trim() || undefined,
    payment_method: data.paymentMethod || 'cash',
    payment_reference: data.paymentMethod === 'gcash' ? data.paymentReference : undefined,
    terminal_reference: data.paymentMethod === 'credit_card' ? data.paymentReference : undefined,
    cash_tendered: data.cashTendered,
    discount_type: data.discountType || null,
    discount_id_number: data.discountIdNumber,
    promo_id: data.promoId || undefined,
    promo_code: data.promoCode || undefined,
    items: itemsPayload,
  };

  let backendOrder: PosOnsiteOrderResponse | undefined;
  let serverChangeDue: number;
  try {
    const employeeToken = sessionStorage.getItem('employee_token');
    const response = await fetch(`${API_URL}/employee/pos/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(employeeToken ? { 'Authorization': `Bearer ${employeeToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json() as {
        order?: PosOnsiteOrderResponse;
        change_due?: number | string;
      };
      backendOrder = result.order;
      serverChangeDue = Number(result.change_due || 0);
    } else {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || `POS order request failed (${response.status}).`);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Could not reach the POS order service.', { cause: err });
  }

  if (!backendOrder?.id || !(backendOrder.orderNumber || backendOrder.order_number)) {
    throw new Error('The POS order service returned an incomplete response.');
  }

  const calculatedTotal = Number(backendOrder.total);
  const orderId = backendOrder.id;
  const orderNumber = backendOrder.orderNumber ?? backendOrder.order_number ?? '';
  const diningLabel = data.diningOption === 'dine_in' ? 'Dine In' : 'Takeout';
  const deliveryAddress = `Onsite - ${diningLabel} (Customer: ${data.customerName?.trim() || 'Walk-in Customer'})`;

  const newOrder: AdminOrder = {
    id: orderId,
    order_number: orderNumber,
    orderNumber: orderNumber,
    email: backendOrder?.email || cashierEmail,
    phone: data.phone || '',
    userId: backendOrder?.user_id || `onsite-${Date.now()}`,
    items: data.items.map((i) => {
      const cartItemId = (i as any).cartItemId || `${i.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: CartItem = {
        id: i.id || (i as any).product_id || cartItemId,
        cartItemId,
        name: i.name || (i as any).product_name || 'Item',
        description: (i as any).description || '',
        price: Number(i.price || (i as any).product_price || 0),
        category: (i as any).category || 'chicken',
        image: (i as any).image || '',
        is_available: true,
        isAvailable: true,
        quantity: Number(i.quantity || 1),
        selectedAddons: i.selectedAddons || (i as any).selected_addons || [],
        specialInstructions: i.specialInstructions || (i as any).special_instructions,
        selectedSize: (i as any).selectedSize as any,
      };
      return item;
    }),
    total: calculatedTotal,
    vat: Number(backendOrder.vat || 0),
    discountType: data.discountType || null,
    discountRate: data.discountRate || 0,
    discountAmount: Number(backendOrder.discount_amount || 0),
    address: deliveryAddress,
    coords: { lat: 0, lng: 0 },
    status: backendOrder?.status || 'pending',
    timestamp: backendOrder?.created_at || new Date().toISOString(),
    created_at: backendOrder?.created_at || new Date().toISOString(),
    paymentMethod: data.paymentMethod,
    payment_method: data.paymentMethod,
    deliveryAddress: deliveryAddress,
    deliveryAddressCoords: { lat: 0, lng: 0 },
    channel: 'onsite',
    customerName: data.customerName?.trim() || 'Walk-in Customer',
    customer_name: data.customerName?.trim() || 'Walk-in Customer',
    diningOption: data.diningOption || 'takeout',
    notes: data.notes || '',
    cashTendered: data.cashTendered,
    changeDue: serverChangeDue,
    payment_reference: backendOrder.payment_reference || data.paymentReference,
    paymentReference: backendOrder.payment_reference || data.paymentReference,
    promo_code: backendOrder.promo_code || data.promoCode,
    promo_discount: Number(backendOrder.promo_discount || 0),
    served: false,
  };

  const existing = getOnsiteOrders();
  const updated = [newOrder, ...existing.filter((o) => o.id !== orderId)];
  localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('onsite-orders-updated', { detail: newOrder }));
  }

  return newOrder;
};

export const fetchOnsiteOrders = async (): Promise<AdminOrder[]> => {
  try {
    const response = await fetch(`${API_URL}/orders`);
    if (!response.ok) return getOnsiteOrders();
    const orders = await response.json();
    if (!Array.isArray(orders)) return getOnsiteOrders();

    const onsiteApiOrders: AdminOrder[] = orders
      .filter((o: any) => o.delivery_type === 'onsite' || o.channel === 'onsite')
      .map((o: any) => {
        const paymentMethod = o.payment_method || 'cash';
        return {
          ...o,
          channel: 'onsite' as const,
          served: o.status === 'delivered',
          customerName: o.customer_name || 'Walk-in Customer',
          customer_name: o.customer_name || 'Walk-in Customer',
          paymentMethod,
          payment_method: paymentMethod,
          total: Number(o.total || 0),
          items: Array.isArray(o.items) ? o.items.map((item: any) => ({
            id: item.product_id || item.id || '',
            cartItemId: `${item.product_id || 'item'}-${Date.now()}`,
            name: item.product_name || item.name || 'Item',
            description: '',
            price: Number(item.product_price || item.price || 0),
            category: 'chicken',
            image: '',
            is_available: true,
            quantity: Number(item.quantity || 1),
            selectedAddons: item.selected_addons || item.selectedAddons || [],
            specialInstructions: item.special_instructions || item.specialInstructions,
          })) : [],
          created_at: o.created_at || o.timestamp || new Date().toISOString(),
          timestamp: o.timestamp || o.created_at || new Date().toISOString(),
        };
      });

    const localOrders = getOnsiteOrders();
    const map = new Map<string, AdminOrder>();
    onsiteApiOrders.forEach((o) => map.set(o.id, o));
    localOrders.forEach((o) => {
      if (!map.has(o.id)) {
        map.set(o.id, o);
      }
    });

    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return getOnsiteOrders();
  }
};

export const markOrderServed = async (orderId: string, channel: OrderChannel): Promise<void> => {
  if (channel === 'onsite') {
    const orders = getOnsiteOrders().map((o) =>
      o.id === orderId ? { ...o, served: true, status: 'delivered' as const } : o
    );
    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onsite-orders-updated'));
    }

    try {
      await fetch(`${API_URL}/orders/${orderId}/status-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      });
    } catch {
    }
  } else {
    updateOnlineOrdersInStorage((orders) =>
      orders.map((o) => (o.id === orderId ? { ...o, status: 'delivered' as const } : o))
    );
    try {
      await orderService.updateOrderStatus(orderId, 'delivered');
    } catch {
    }
  }
};

export const removeOrder = async (orderId: string, channel: OrderChannel): Promise<void> => {
  if (channel === 'onsite') {
    const orders = getOnsiteOrders().filter((o) => o.id !== orderId);
    localStorage.setItem(ONSITE_ORDERS_KEY, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onsite-orders-updated'));
    }

    try {
      await fetch(`${API_URL}/orders/${orderId}/status-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
    } catch {
    }
  } else {
    updateOnlineOrdersInStorage((orders) => orders.filter((o) => o.id !== orderId));
    try {
      await orderService.updateOrderStatus(orderId, 'cancelled');
    } catch {
    }
  }
};
