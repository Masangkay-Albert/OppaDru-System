import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Eye, RefreshCw, Clock, Truck, Package, Coffee, CalendarDays, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, markOrderServed, type AdminOrder } from '../../../services/adminOrderService';
import { formatCurrency } from '../../../utils/formatters';
import { getScheduledOrderDetails } from '../../../utils/orderUtils';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  scheduled: 'bg-orange-100 text-orange-700',
  on_the_way: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  preparing: Coffee,
  ready: Package,
  scheduled: CalendarDays,
  on_the_way: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'onsite'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(false);

  const loadOrders = async (forceRefresh = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const allOrders = await getAllOrders(forceRefresh);
      const freshOrders = Array.isArray(allOrders) ? allOrders : [];
      setOrders(freshOrders);
      setSelectedOrder((current) => current
        ? freshOrders.find((order) => order.id === current.id) || current
        : null
      );
    } catch {
      if (showLoading) setOrders([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders(true);
    const interval = window.setInterval(() => {
      void loadOrders(true, false);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const handleMarkDelivered = async (order: AdminOrder) => {
    try {
      await markOrderServed(order.id, order.channel);
      await loadOrders();
    } catch {
      // Silently fail
    }
  };

  const getOrderTimestamp = (order: AdminOrder): number => {
    const raw = order.created_at || order.timestamp;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!isNaN(time)) return time;
    }
    const match = order.order_number?.match(/(\d{4})(\d{2})(\d{2})/);
    if (match) {
      const time = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`).getTime();
      if (!isNaN(time)) return time;
    }
    return 0;
  };

  const getOrderDateYMD = (order: AdminOrder): string => {
    const raw = order.created_at || order.timestamp;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    const match = order.order_number?.match(/(\d{4})(\d{2})(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return '';
  };

  const isScheduledOrder = (order: AdminOrder) => {
    if (!order) return false;
    const status = String(order.status || '').toLowerCase();
    if (status === 'scheduled') return true;
    const deliveryType = String((order as any).delivery_type || (order as any).deliveryType || '').toLowerCase();
    if (deliveryType === 'scheduled') return true;
    return !!(order as any).scheduled_at || !!(order as any).scheduled_date || !!(order as any).scheduled_time || !!(order as any).schedule_display;
  };

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      if (channelFilter !== 'all' && order.channel !== channelFilter) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'scheduled') {
          if (order.status !== 'scheduled' && !isScheduledOrder(order)) {
            return false;
          }
        } else if (order.status !== statusFilter) {
          return false;
        }
      }

      if (dateFilter !== '') {
        const orderDateYMD = getOrderDateYMD(order);
        if (orderDateYMD !== dateFilter) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const timeA = getOrderTimestamp(a);
      const timeB = getOrderTimestamp(b);
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [orders, channelFilter, statusFilter, dateFilter, sortOrder]);

  const handleClearFilters = () => {
    setChannelFilter('all');
    setStatusFilter('all');
    setDateFilter('');
    setSortOrder('desc');
  };

  const hasActiveFilters = channelFilter !== 'all' || statusFilter !== 'all' || dateFilter !== '' || sortOrder !== 'desc';

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status] || Clock;
    return <Icon className="h-4 w-4" />;
  };

  const getOrderItemsSummary = (items: any[]) => {
    if (!items || items.length === 0) return 'No items';
    return items.map((item) => `${item.quantity}x ${item.product_name || item.name || 'Item'}`).join(', ');
  };

  const formatPrice = (price: number | string) => {
    const num = Number(price);
    return isNaN(num) ? 0 : num;
  };

  const getOrderDate = (order: Pick<AdminOrder, 'created_at' | 'timestamp' | 'order_number'>): string => {
    const orderDate = order.created_at || order.timestamp;
    if (orderDate) return String(orderDate);

    const match = order.order_number?.match(/(\d{4})(\d{2})(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00` : '';
  };

  const formatPaymentMethod = (value?: string) => {
    const normalized = (value || 'cash_on_delivery').toLowerCase().replace(/\s+/g, '_');

    switch (normalized) {
      case 'cash_on_delivery':
      case 'cash':
        return 'Cash on Delivery';
      case 'gcash':
        return 'GCash';
      case 'credit_card':
      case 'credit-card':
        return 'Credit Card';
      default:
        return normalized
          .split('_')
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
    }
  };

  const formatDate = (date?: string | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    try {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      });
    } catch {
      return d.toLocaleString();
    }
  };

  const formatOrderDate = (date?: string | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    try {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatOrderTime = (date?: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      });
    } catch {
      return '';
    }
  };

  const getScheduledDisplay = (order: AdminOrder) => {
    if (!order) return 'Scheduled';
    try {
      const details = getScheduledOrderDetails(order);
      if (details?.scheduleDisplay) return details.scheduleDisplay;
      if (details?.scheduledDate && details?.scheduledTime) {
        return `${details.scheduledDate} • ${details.scheduledTime}`;
      }
      if (details?.scheduledDate) return details.scheduledDate;
    } catch {
      // Fallback
    }
    const scheduledAt = (order as any).scheduled_at;
    if (scheduledAt) return formatDate(scheduledAt);
    return 'Scheduled';
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Orders</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Track online and onsite orders in real time.</p>
          </div>
          <button
            onClick={() => void loadOrders(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="mb-5 space-y-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Channel Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Channel</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="mt-1 block h-[38px] w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]"
            >
              <option value="all">All Channels</option>
              <option value="online">Online</option>
              <option value="onsite">Onsite</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block h-[38px] w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="scheduled">Scheduled</option>
              <option value="on_the_way">On the way</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Exact Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="block h-[38px] w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  title="Clear date"
                  className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-[var(--oppa-text-muted)] hover:bg-slate-100 hover:text-[var(--oppa-text)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders Count Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--oppa-border)]/60 pt-3 text-xs text-[var(--oppa-text-muted)]">
          <span>
            Showing <strong className="font-semibold text-[var(--oppa-text)]">{filteredOrders.length}</strong> of{' '}
            <strong className="font-semibold text-[var(--oppa-text)]">{orders.length}</strong> orders
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 font-semibold text-[var(--oppa-green-dark)] underline hover:text-[var(--oppa-text)]"
            >
              <X size={13} /> Clear all filters
            </button>
          )}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Package className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">No orders match your filter criteria.</p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--oppa-green-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] transition hover:bg-[var(--oppa-green-soft)]/70"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="w-[12%] px-3 py-3 font-semibold">Order ID</th>
                <th className="w-[17%] px-3 py-3 font-semibold">Customer</th>
                <th className="w-[10%] px-3 py-3 font-semibold">Channel</th>
                <th className="w-[20%] px-3 py-3 font-semibold">Items</th>
                <th className="w-[11%] px-3 py-3 font-semibold">Total</th>
                <th className="w-[12%] px-3 py-3 font-semibold">Status</th>
                <th className="w-[10%] px-3 py-3 font-semibold">
                  <div className="inline-flex items-center gap-1">
                    <span>Date</span>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                      aria-label="Sort by date"
                      className="cursor-pointer rounded border border-[var(--oppa-border)] bg-white px-1 py-0.5 text-[10px] font-normal normal-case text-[var(--oppa-text)] outline-none transition hover:border-[var(--oppa-green)] focus:border-[var(--oppa-green)]"
                    >
                      <option value="desc">↓ New</option>
                      <option value="asc">↑ Old</option>
                    </select>
                  </div>
                </th>
                <th className="w-[8%] px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const StatusIcon = statusIcons[order.status] || Clock;
                const isDelivered = order.status === 'delivered';
                const itemsSummary = getOrderItemsSummary(order.items);
                const orderDate = getOrderDate(order);

                return (
                  <tr
                    key={order.id}
                    className="border-b border-[var(--oppa-border)]/60 last:border-0 transition hover:bg-[var(--oppa-cream)]/50"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[var(--oppa-text)] truncate" title={order.order_number || order.id}>
                      #{order.order_number ? order.order_number.slice(0, 10) : order.id?.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2.5 min-w-0">
                      <div className="truncate" title={order.customerName || order.email || 'Guest'}>
                        <p className="truncate font-medium text-xs text-[var(--oppa-text)]">
                          {order.customerName || order.email || 'Guest'}
                        </p>
                        {order.email && order.customerName && (
                          <p className="truncate text-[11px] text-[var(--oppa-text-muted)]">{order.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                        order.channel === 'onsite' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 min-w-0">
                      <p className="truncate text-xs text-[var(--oppa-text-muted)]" title={itemsSummary}>
                        {itemsSummary}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-xs text-[var(--oppa-text)] whitespace-nowrap">
                      {formatCurrency(order.total || 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                          statusColors[order.status] || 'bg-gray-100 text-gray-700'
                        }`}>
                          <StatusIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{statusLabels[order.status] || order.status}</span>
                        </span>
                        {isScheduledOrder(order) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 whitespace-nowrap" title={getScheduledDisplay(order)}>
                            <CalendarDays className="h-2.5 w-2.5 flex-shrink-0" />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="text-xs font-medium text-[var(--oppa-text)]">{formatOrderDate(orderDate)}</p>
                      <p className="text-[11px] text-[var(--oppa-text-muted)]">{formatOrderTime(orderDate)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {order.channel === 'onsite' && !isDelivered && (
                          <button
                            type="button"
                            onClick={() => void handleMarkDelivered(order)}
                            title="Mark Delivered"
                            className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 transition hover:bg-green-100"
                          >
                            <CheckCircle size={12} />
                            <span className="hidden xl:inline">Serve</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          title="View order details"
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 border border-[var(--oppa-border)]/60"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrder(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">
                  Order Details
                </h2>
                <p className="text-sm text-[var(--oppa-text-muted)]">
                  #{selectedOrder.order_number ? selectedOrder.order_number.slice(0, 12) : selectedOrder.id?.slice(0, 12)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName || selectedOrder.email || 'Guest'}</p>
                  {selectedOrder.email && (
                    <p className="text-sm text-[var(--oppa-text-muted)]">{selectedOrder.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Channel</p>
                  <p className="font-medium capitalize">{selectedOrder.channel || 'online'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Payment Method</p>
                  <p className="font-medium">
                    {formatPaymentMethod(selectedOrder.paymentMethod || selectedOrder.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Status</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    statusColors[selectedOrder.status] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {getStatusIcon(selectedOrder.status)}
                    {statusLabels[selectedOrder.status] || selectedOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Delivery</p>
                  <p className="font-medium capitalize">{String((selectedOrder as any).delivery_type || (selectedOrder as any).deliveryType || 'standard').replace('_', ' ')}</p>
                </div>
              </div>

              {isScheduledOrder(selectedOrder) && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Scheduled delivery</p>
                  <p className="mt-1 text-sm font-medium text-[var(--oppa-text)]">{getScheduledDisplay(selectedOrder)}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-[var(--oppa-text-muted)]">Order Date</p>
                <p className="text-sm">{formatDate(getOrderDate(selectedOrder))}</p>
              </div>

              <div>
                <p className="text-xs text-[var(--oppa-text-muted)]">Delivery Address</p>
                <p className="text-sm">{selectedOrder.deliveryAddress || 'Onsite / Walk-in'}</p>
              </div>

              {selectedOrder.status === 'delivered' && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle size={16} /> Delivered
                  </div>
                  <p className="mt-1 text-green-700">This order has been marked delivered by the assigned driver.</p>
                </div>
              )}

              {(selectedOrder.delivery_proof_image_url || selectedOrder.status === 'delivered') && (
                <div className="rounded-xl border border-[var(--oppa-border)] p-4">
                  <p className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Delivery Proof</p>
                  {selectedOrder.delivery_proof_image_url ? (
                    <a href={selectedOrder.delivery_proof_image_url} target="_blank" rel="noreferrer" className="inline-block">
                      <img
                        src={selectedOrder.delivery_proof_image_url}
                        alt="Driver's delivery proof"
                        className="max-h-72 max-w-full rounded-lg border border-[var(--oppa-border)] object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-[var(--oppa-text-muted)]">No delivery photo has been uploaded.</p>
                  )}
                  {selectedOrder.delivery_proof_uploaded_at && (
                    <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">
                      Sent {formatDate(selectedOrder.delivery_proof_uploaded_at)}
                    </p>
                  )}
                </div>
              )}

              {selectedOrder.phone && (
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Phone</p>
                  <p className="text-sm">{selectedOrder.phone}</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs text-[var(--oppa-text-muted)]">Items</p>
                <div className="space-y-2 rounded-lg bg-[var(--oppa-cream)] p-4">
                  {selectedOrder.items?.map((item: any, index: number) => {
                    const itemPrice = formatPrice(item.product_price || item.price || 0);
                    const itemName = item.product_name || item.name || 'Item';
                    const quantity = item.quantity || 1;
                    
                    return (
                      <div key={index} className="flex items-center justify-between border-b border-[var(--oppa-border)]/30 pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{itemName}</p>
                          <p className="text-xs text-[var(--oppa-text-muted)]">
                            Qty: {quantity}
                            {item.selected_addons && item.selected_addons.length > 0 && (
                              <span className="ml-2">
                                Addons: {item.selected_addons.map((a: any) => `${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ''}`).join(', ')}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="font-semibold">{formatCurrency(itemPrice * quantity)}</p>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-[var(--oppa-border)]/30 pt-2">
                    <p className="font-bold">Total</p>
                    <p className="font-bold text-[var(--oppa-text)]">{formatCurrency(selectedOrder.total || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminOrdersPage;