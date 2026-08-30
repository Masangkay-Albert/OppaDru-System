const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';

export interface OrderItem {
    product_id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    selected_addons?: Array<{ id: string; name: string; price: number; quantity?: number }>;
    special_instructions?: string;
}

export interface CreateOrderData {
    email: string;
    items: OrderItem[];
    total: number;
    delivery_address: string;
    payment_method: 'cash_on_delivery' | 'gcash' | 'credit_card';
    delivery_type?: 'standard' | 'priority' | 'scheduled';
    phone: string;
    delivery_coordinates?: { lat: number; lng: number };
    payment_reference?: string;
    voucher_discount?: number;
    discount_rate?: number;
    scheduled_at?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    schedule_display?: string | null;
    schedule_window?: string | null;
}

export interface Order {
    id: string;
    email: string;
    order_number: string;
    total: number;
    status: string;
    payment_method: string;
    delivery_address: string;
    delivery_type?: 'standard' | 'priority' | 'scheduled';
    delivery_fee?: number;
    service_fee?: number;
    priority_fee?: number;
    vat?: number;
    phone: string;
    items: OrderItem[];
    created_at?: string;
    updated_at?: string;
    scheduled_at?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    schedule_display?: string | null;
    schedule_window?: string | null;
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
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await this.readError(response);
            throw new Error(error || 'Failed to place order');
        }

        const result = await response.json();
        return result.order;
    }

    private async readError(response: Response): Promise<string> {
        try {
            const error = await response.json();
            if (error.message) return error.message;
            if (error.errors) {
                return Object.values(error.errors).flat().join(' ');
            }
        } catch {
            return response.statusText;
        }

        return response.statusText;
    }

    async getUserOrders(): Promise<Order[]> {
        const response = await fetch(`${API_URL}/orders/user`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch orders');
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