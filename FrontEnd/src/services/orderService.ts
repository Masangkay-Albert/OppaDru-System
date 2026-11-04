const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';

export interface OrderItem {
    product_id: string;
    franchise_id?: string | null;
    product_name: string;
    product_price: number;
    quantity: number;
    selected_addons?: Array<{ id: string; name: string; price: number; quantity?: number }>;
    special_instructions?: string;
}

export interface DeliveryInstructions {
    block?: string;
    lot?: string;
    street?: string;
    floor?: string;
    unit?: string;
    building?: string;
    note?: string;
}

export interface CreateOrderData {
    email: string;
    franchise_id?: string;
    items: OrderItem[];
    total: number;
    delivery_address: string;
    delivery_instructions?: DeliveryInstructions;
    include_cutlery?: boolean;
    payment_method: 'cash_on_delivery' | 'gcash' | 'credit_card';
    delivery_type?: 'standard' | 'priority' | 'scheduled';
    phone: string;
    delivery_coordinates?: { lat: number; lng: number };
    payment_reference?: string;
    voucher_discount?: number;
    promo_code?: string | null;
    discount_rate?: number;
    discount_type?: 'PWD' | 'Senior Citizen';
    proof_image?: File | null;
    scheduled_at?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    schedule_display?: string | null;
    schedule_window?: string | null;
    driver_id?: string | null;
    driverId?: string | null;
    driver?: {
        id?: string;
        name?: string;
        phone?: string;
        vehicle_type?: string;
        vehicleType?: string;
    } | null;
}

export interface Order {
    id: string;
    email: string;
    order_number: string;
    branch_id?: string | null;
    franchise_id?: string | null;
    branch_name?: string | null;
    branchName?: string | null;
    branch?: { id?: string; name?: string; latitude?: number; longitude?: number; address?: string } | null;
    franchise?: { id?: string; name?: string; latitude?: number; longitude?: number; address?: string } | null;
    total: number;
    status: string;
    cancellation_remaining_seconds?: number;
    status_history?: Array<{ status: string; created_at?: string | null }>;
    payment_method: string;
    payment_status?: string;
    delivery_address: string;
    delivery_instructions?: DeliveryInstructions | null;
    delivery_coordinates?: { lat: number; lng: number } | null;
    delivery_type?: 'standard' | 'priority' | 'scheduled';
    delivery_fee?: number;
    service_fee?: number;
    priority_fee?: number;
    vat?: number;
    phone: string;
    items: OrderItem[];
    created_at?: string;
    updated_at?: string;
    discount_type?: 'PWD' | 'Senior Citizen' | null;
    discount_rate?: number;
    discount_amount?: number;
    discount_status?: string;
    discount_proof_image?: string | null;
    scheduled_at?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    schedule_display?: string | null;
    schedule_window?: string | null;
    driver_id?: string | null;
    driverId?: string | null;
    driver?: {
        id?: string;
        name?: string;
        phone?: string;
        vehicle_type?: string;
        vehicleType?: string;
    } | null;
}

export class OrderServiceError extends Error {
    readonly status?: number;
    readonly code?: string;
    readonly title?: string;
    readonly nearestBranch?: { id?: string; name?: string };
    readonly cartBranch?: { id?: string; name?: string | null };
    readonly servingBranch?: { id?: string; name?: string };
    readonly distanceKm?: number;

    constructor(message: string, status?: number, details?: {
        code?: string;
        title?: string;
        nearestBranch?: { id?: string; name?: string };
        cartBranch?: { id?: string; name?: string | null };
        servingBranch?: { id?: string; name?: string };
        distanceKm?: number;
    }) {
        super(message);
        this.name = 'OrderServiceError';
        this.status = status;
        this.code = details?.code;
        this.title = details?.title;
        this.nearestBranch = details?.nearestBranch;
        this.cartBranch = details?.cartBranch;
        this.servingBranch = details?.servingBranch;
        this.distanceKm = details?.distanceKm;
    }
}

export interface UpdateOrderData {
    items: OrderItem[];
    delivery_type?: 'standard' | 'priority' | 'scheduled';
    delivery_address?: string;
    phone?: string;
}

class OrderService {
    private tokenKey = 'auth_token';
    private adminTokenKey = 'adminToken';

    private getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    private getAdminToken(): string | null {
        return localStorage.getItem(this.adminTokenKey);
    }

    private getHeaders(useAdminToken = false): HeadersInit {
        const token = useAdminToken ? this.getAdminToken() : this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    async createOrder(data: CreateOrderData): Promise<Order> {
        const hasProof = Boolean(data.proof_image);
        const isFormData = hasProof || data.discount_type !== undefined;

        const body = isFormData ? new FormData() : JSON.stringify(data);

        if (isFormData) {
            const formData = body as FormData;
            formData.append('email', data.email);
            if (data.franchise_id) formData.append('franchise_id', data.franchise_id);
            formData.append('items', JSON.stringify(data.items));
            formData.append('total', String(data.total));
            formData.append('delivery_address', data.delivery_address);
            if (data.delivery_instructions) {
                formData.append('delivery_instructions', JSON.stringify(data.delivery_instructions));
            }
            formData.append('include_cutlery', String(data.include_cutlery ?? false));
            formData.append('payment_method', data.payment_method);
            if (data.delivery_type) formData.append('delivery_type', data.delivery_type);
            formData.append('phone', data.phone);
            if (data.delivery_coordinates) {
                formData.append('delivery_coordinates[lat]', String(data.delivery_coordinates.lat));
                formData.append('delivery_coordinates[lng]', String(data.delivery_coordinates.lng));
            }
            if (data.payment_reference) formData.append('payment_reference', data.payment_reference);
            if (data.promo_code) formData.append('promo_code', data.promo_code);
            if (typeof data.discount_rate !== 'undefined') formData.append('discount_rate', String(data.discount_rate));
            if (data.discount_type) formData.append('discount_type', data.discount_type);
            if (data.proof_image) formData.append('proof_image', data.proof_image);
            if (data.scheduled_at) formData.append('scheduled_at', data.scheduled_at);
            if (data.scheduled_date) formData.append('scheduled_date', data.scheduled_date);
            if (data.scheduled_time) formData.append('scheduled_time', data.scheduled_time);
            if (data.schedule_display) formData.append('schedule_display', data.schedule_display);
            if (data.schedule_window) formData.append('schedule_window', data.schedule_window);
        }

        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: isFormData ? {
                ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
            } : this.getHeaders(),
            body: isFormData ? body as FormData : body as string,
        });

        if (!response.ok) {
            const error: Record<string, unknown> = await response.json().catch(() => ({}));
            const validationErrors = error.errors && typeof error.errors === 'object'
                ? Object.values(error.errors as Record<string, unknown>)
                    .flatMap((messages) => Array.isArray(messages) ? messages.filter((message): message is string => typeof message === 'string') : [])
                    .join(' ')
                : '';
            const nearest = error.nearest_branch && typeof error.nearest_branch === 'object'
                ? error.nearest_branch as Record<string, unknown>
                : undefined;
            const cart = error.cart_branch && typeof error.cart_branch === 'object'
                ? error.cart_branch as Record<string, unknown>
                : undefined;
            const serving = error.serving_branch && typeof error.serving_branch === 'object'
                ? error.serving_branch as Record<string, unknown>
                : undefined;
            throw new OrderServiceError(
                typeof error.message === 'string' ? error.message : validationErrors || 'Failed to place order',
                response.status,
                {
                    code: typeof error.code === 'string' ? error.code : undefined,
                    title: typeof error.title === 'string' ? error.title : undefined,
                    nearestBranch: nearest ? {
                        id: typeof nearest.id === 'string' ? nearest.id : undefined,
                        name: typeof nearest.name === 'string' ? nearest.name : undefined,
                    } : undefined,
                    cartBranch: cart ? {
                        id: typeof cart.id === 'string' ? cart.id : undefined,
                        name: typeof cart.name === 'string' ? cart.name : null,
                    } : undefined,
                    servingBranch: serving ? {
                        id: typeof serving.id === 'string' ? serving.id : undefined,
                        name: typeof serving.name === 'string' ? serving.name : undefined,
                    } : undefined,
                    distanceKm: typeof error.distance_km === 'number' ? error.distance_km : undefined,
                },
            );
        }

        const result = await response.json();
        return result.order;
    }

    async getUserOrders(): Promise<Order[]> {
        const response = await fetch(`${API_URL}/orders/user`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new OrderServiceError(response.status === 401
                ? 'Order history request was unauthorized (401).'
                : 'Failed to fetch orders', response.status);
        }

        return response.json();
    }

    async getUserOrder(id: string, signal?: AbortSignal): Promise<Order> {
        const response = await fetch(`${API_URL}/orders/user/${encodeURIComponent(id)}`, {
            headers: this.getHeaders(),
            signal,
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new OrderServiceError(
                response.status === 404 || response.status === 403
                    ? 'This order could not be found in your account.'
                    : payload.message || 'We could not load your order right now.',
                response.status,
            );
        }
        return response.json();
    }

    async getOrder(id: string): Promise<Order> {
        const response = await fetch(`${API_URL}/orders/${id}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch order');
        }

        return response.json();
    }

    async updateOrder(id: string, data: UpdateOrderData): Promise<Order> {
        const token = this.getToken();
        const response = await fetch(`${API_URL}/orders/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || error.error || 'Failed to update order');
        }

        const result = await response.json();
        return result.order;
    }

    async updateOrderStatus(id: string, status: string): Promise<Order> {
        const userToken = this.getToken();
        const adminToken = this.getAdminToken();
        const token = userToken || adminToken;

        const response = await fetch(`${API_URL}/orders/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ status }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || error.error || 'Failed to update order status');
        }

        const result = await response.json();
        return result.order;
    }
}

export const orderService = new OrderService();
