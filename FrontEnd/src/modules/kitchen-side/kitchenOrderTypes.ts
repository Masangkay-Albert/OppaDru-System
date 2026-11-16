export interface KitchenOrderItem {
  name: string;
  quantity: number;
  selected_size?: string | null;
  selected_addons?: Array<{ name: string; quantity: number }>;
  special_instructions?: string | null;
}

export interface KitchenOrder {
  id: string;
  order_number?: string;
  is_replacement?: boolean;
  original_order_number?: string | null;
  replacement_of_order_id?: string | null;
  branch_name?: string | null;
  branchName?: string | null;
  customerName: string;
  phone?: string | null;
  channel?: 'online' | 'onsite';
  status: string;
  include_cutlery?: boolean;
  items: KitchenOrderItem[];
  scheduleDisplay?: string | null;
  deliveryType?: string | null;
  fulfillmentType?: 'pickup' | 'delivery';
  isScheduled?: boolean;
  scheduledFor?: string | null;
  prepStartTime?: string | null;
  prepLeadTimeMinutes?: number;
  rescheduledFrom?: string | null;
  specialInstructions?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  created_at: string;
}

export type KitchenTab = 'pending' | 'scheduled' | 'preparing' | 'history';
export type KitchenSort = 'desc' | 'asc' | 'due';
export type ScheduledDateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'custom';
