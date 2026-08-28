import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, RefreshCw, Clock, Truck, Package, Coffee } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, type AdminOrder } from '../../../services/adminOrderService';
import { orderService } from '../../../services/orderService';
import { formatCurrency } from '../../../utils/formatters';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  preparing: Coffee,
  ready: Package,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [filter, setFilter] = useState<'all' | 'online' | 'onsite'>('all');
  const [loading, setLoading] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await getAllOrders();
      setOrders(Array.isArray(allOrders) ? allOrders : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await orderService.updateOrderStatus(orderId, 'delivered');
      await loadOrders();
    } catch {
      // Silently fail
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.channel === filter;
  });

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

  const getOrderDate = (order: Pick<AdminOrder, 'created_at' | 'order_number'>) => {
    if (order.created_at) return order.created_at;
    const match = order.order_number?.match(/(\d{4})(\d{2})(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00` : '';
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'online', 'onsite'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type as any)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === type
                ? 'bg-oppa-gradient text-white shadow-sm'
                : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
            }`}
          >
            {type === 'all' ? 'All' : type === 'online' ? 'Online' : 'Onsite'}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Package className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">No orders found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const StatusIcon = statusIcons[order.status] || Clock;
                const isDelivered = order.status === 'delivered';

                return (
                  <tr key={order.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {order.order_number ? order.order_number.slice(0, 12) : order.id?.slice(0, 12)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--oppa-text)]">
                          {order.customerName || order.email || 'Guest'}
                        </p>
                        {order.email && (
                          <p className="text-xs text-[var(--oppa-text-muted)]">{order.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        order.channel === 'onsite' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] truncate text-xs text-[var(--oppa-text-muted)]">
                        {getOrderItemsSummary(order.items)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--oppa-text)]">
                      {formatCurrency(order.total || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        statusColors[order.status] || 'bg-gray-100 text-gray-700'
                      }`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--oppa-text-muted)]">
                      {formatDate(getOrderDate(order))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!isDelivered && (
                          <button
                            onClick={() => handleMarkDelivered(order.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-600 transition hover:bg-green-100"
                          >
                            <CheckCircle size={13} />
                            Mark Delivered
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                        >
                          <Eye size={13} />
                          View
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
                  <p className="font-medium capitalize">{selectedOrder.paymentMethod || 'Cash'}</p>
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
              </div>

              <div>
                <p className="text-xs text-[var(--oppa-text-muted)]">Order Date</p>
                <p className="text-sm">{formatDate(getOrderDate(selectedOrder))}</p>
              </div>

              <div>
                <p className="text-xs text-[var(--oppa-text-muted)]">Delivery Address</p>
                <p className="text-sm">{selectedOrder.deliveryAddress || 'Onsite / Walk-in'}</p>
              </div>

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
                                Addons: {item.selected_addons.map((a: any) => a.name).join(', ')}
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