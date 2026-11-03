import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, X, Eye, Package, CalendarDays, Copy, Globe2, Store, RotateCcw } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AdminDate, Avatar, EmptyState, PageHeader, StatusBadge, Toast } from '../components/AdminUI';
import { getAllOrders, type AdminOrder } from '../../../services/adminOrderService';
import { formatCurrency } from '../../../utils/formatters';
import { getScheduledOrderDetails } from '../../../utils/orderUtils';
import Select from '../../../components/ui/Select';
import OrdersFilterBar from '../../shared/components/OrdersFilterBar';

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
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'onsite'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [notice, setNotice] = useState('');
  const routeOrderId = useRef((location.state as { orderId?: string } | null)?.orderId);

  const loadOrders = useCallback(async (forceRefresh = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const allOrders = await getAllOrders(forceRefresh);
      const freshOrders = Array.isArray(allOrders) ? allOrders : [];
      setOrders(freshOrders);
      setLoadError(false);
      setSelectedOrder((current) => current
        ? freshOrders.find((order) => order.id === current.id) || current
        : freshOrders.find((order) => order.id === routeOrderId.current) || null
      );
      if (routeOrderId.current && freshOrders.some((order) => order.id === routeOrderId.current)) {
        routeOrderId.current = undefined;
        navigate(location.pathname, { replace: true, state: null });
      }
    } catch {
      if (showLoading) {
        setOrders([]);
        setLoadError(true);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadOrders(true); }, 0);
    const interval = window.setInterval(() => { void loadOrders(true, false); }, 1000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadOrders]);

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
    const deliveryType = String(order.delivery_type || '').toLowerCase();
    if (deliveryType === 'scheduled') return true;
    return !!order.scheduled_at || !!order.scheduled_date || !!order.scheduled_time || !!order.schedule_display;
  };

  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const orderQuery = `${order.order_number || ''} ${order.id || ''} ${order.customerName || ''} ${order.email || ''}`.toLowerCase();
      if (!orderQuery.includes(searchTerm.trim().toLowerCase())) return false;
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
      const valueA = sortBy === 'total' ? Number(a.total || 0) : getOrderTimestamp(a);
      const valueB = sortBy === 'total' ? Number(b.total || 0) : getOrderTimestamp(b);
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }, [orders, channelFilter, statusFilter, dateFilter, sortOrder, searchTerm, sortBy]);

  const statusTabs = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'On the way', value: 'on_the_way' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];
  const statusCounts = (status: string) => orders.filter((order) => status === 'all' || String(order.status).toLowerCase() === status).length;

  const hasActiveFilters = channelFilter !== 'all' || dateFilter !== '' || searchTerm !== '' || statusFilter !== 'all';
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));

  const copyOrderId = (orderId: string) => {
    if (!navigator.clipboard) {
      setNotice('Copying order IDs is not supported by this browser.');
      return;
    }
    void navigator.clipboard.writeText(orderId).then(() => { setCopiedOrderId(orderId); setNotice('Order ID copied.'); }).catch((error: unknown) => { console.error('Failed to copy order ID:', error); setNotice('Could not copy order ID.'); });
  };

  const getFirstOrderItemSummary = (items: Array<{ quantity?: number; product_name?: string; name?: string }> | undefined) =>
    !items?.length ? 'No items' : `${items[0].quantity || 1}x ${items[0].product_name || items[0].name || 'Item'}`;

  const getFullItemsSummary = (items: Array<{ quantity?: number; product_name?: string; name?: string }> | undefined) =>
    !items?.length ? 'No items' : items.map((item) => `${item.quantity || 1}x ${item.product_name || item.name || 'Item'}`).join(', ');

  const getCompactOrderId = (value: string) => value.length > 22 ? `${value.slice(0, 15)}…${value.slice(-6)}` : value;

  const clearFilters = () => {
    setSearchTerm('');
    setChannelFilter('all');
    setStatusFilter('all');
    setDateFilter('');
    setCurrentPage(1);
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
        timeZone: 'Asia/Manila',
      });
    } catch {
      return d.toLocaleString();
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
    const scheduledAt = order.scheduled_at;
    if (scheduledAt) return formatDate(scheduledAt);
    return 'Scheduled';
  };

  return (
    <AdminLayout>
      <div className="admin-orders-page">
      {notice && <Toast message={notice} tone={notice.startsWith('Could') || notice.startsWith('Copying') ? 'error' : 'success'} onDismiss={() => setNotice('')} />}
      <PageHeader title="Orders" subtitle="Track online and onsite orders in real time." />

      <section className="admin-orders-controls">
        <div className="admin-orders-tabs-row">
          <div role="tablist" aria-label="Filter orders by status" className="admin-orders-tabs">
            {statusTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={statusFilter === tab.value} onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }} className={`admin-orders-tab ${statusFilter === tab.value ? 'is-active' : ''}`}>
              <span>{tab.label}</span><span className="admin-orders-tab-count">{statusCounts(tab.value)}</span>
            </button>)}
          </div>
          <span className="admin-orders-result-count">Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders</span>
        </div>

        <OrdersFilterBar
          search={searchTerm}
          onSearchChange={(value) => { setSearchTerm(value); setCurrentPage(1); }}
          channel={channelFilter}
          onChannelChange={(value) => { setChannelFilter(value); setCurrentPage(1); }}
          date={dateFilter}
          onDateChange={(value) => { setDateFilter(value); setCurrentPage(1); }}
          onClear={hasActiveFilters ? clearFilters : undefined}
        />
      </section>

      {loading ? (
        <div role="status" aria-label="Loading orders" aria-busy="true" className="admin-orders-skeleton">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="admin-orders-skeleton-row" />)}
        </div>
      ) : loadError ? (
        <div className="admin-card">
          <EmptyState icon={<Package size={23} />} title="Could not load orders" description="Please check your connection and try again." action={<button type="button" onClick={() => void loadOrders(true)} className="admin-orders-retry"><RotateCcw size={14} />Retry</button>} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-card">
          <EmptyState icon={<Package size={23} />} title={hasActiveFilters ? 'No orders match these filters' : 'No orders yet'} description={hasActiveFilters ? 'Try adjusting your filters.' : 'New orders will appear here as customers place them.'} action={hasActiveFilters ? <button type="button" onClick={clearFilters} className="admin-orders-retry">Clear filters</button> : undefined} />
        </div>
      ) : (
        <div className="admin-orders-table-shell">
          <div className="admin-orders-table-scroll">
          <table className="admin-table admin-orders-table w-full table-fixed text-left text-sm">
            <caption className="sr-only">Customer orders. Select a row or use View to inspect order details.</caption>
            <colgroup>
              <col className="order-id-column" /><col className="customer-column" /><col className="channel-column" />
              <col className="branch-column" /><col className="items-column" /><col className="total-column" />
              <col className="status-column" /><col className="date-column" /><col className="action-column" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Order ID</th>
                <th scope="col">Customer</th>
                <th scope="col" className="channel-column">Channel</th>
                <th scope="col" className="branch-column">Branch</th>
                <th scope="col">Items</th>
                <th scope="col" className="total-heading" aria-sort={sortBy === 'total' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => { setSortBy('total'); setSortOrder(sortBy === 'total' && sortOrder === 'desc' ? 'asc' : 'desc'); }} aria-label={`Sort total ${sortBy === 'total' && sortOrder === 'desc' ? 'ascending' : 'descending'}`}>Total <span aria-hidden="true">{sortBy === 'total' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span></button>
                </th>
                <th scope="col">Status</th>
                <th scope="col" aria-sort={sortBy === 'date' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => { setSortBy('date'); setSortOrder(sortBy === 'date' && sortOrder === 'desc' ? 'asc' : 'desc'); }} aria-label={`Sort date ${sortBy === 'date' && sortOrder === 'desc' ? 'oldest first' : 'newest first'}`}>Date <span aria-hidden="true">{sortBy === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : '↕'}</span></button>
                </th>
                <th scope="col" className="action-heading">View</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const fullItemsSummary = getFullItemsSummary(order.items);
                const orderDate = getOrderDate(order);
                const orderId = String(order.order_number || order.id || '');

                return (
                  <tr
                    key={order.id}
                    className="admin-orders-row group"
                    tabIndex={0}
                    aria-label={`View order ${orderId}`}
                    onClick={() => setSelectedOrder(order)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        setSelectedOrder(order);
                      }
                    }}
                  >
                    <td data-label="Order ID" className="order-id-cell" title={orderId}>
                      <span>{getCompactOrderId(orderId)}</span>
                      <button type="button" aria-label={`Copy order ID ${orderId}`} title={copiedOrderId === orderId ? 'Copied' : 'Copy order ID'} onClick={(event) => { event.stopPropagation(); copyOrderId(orderId); }} className="admin-order-copy"><Copy size={14} /></button>
                    </td>
                    <td data-label="Customer" className="customer-cell">
                      <div className="admin-order-customer" title={order.customerName || order.email || 'Guest'}>
                        <Avatar name={order.customerName || order.email || 'Guest'} className="size-9" />
                        <div className="min-w-0"><p className="customer-name">
                          {(order.customerName || order.email || 'Guest').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}
                        </p>
                        {order.email && order.customerName && (
                          <p className="customer-email" title={order.email}>{order.email}</p>
                        )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Channel" className="channel-cell channel-column">
                      <span className={`admin-order-channel ${order.channel === 'onsite' ? 'is-onsite' : 'is-online'}`}>
                        {order.channel === 'onsite' ? <Store size={13} /> : <Globe2 size={13} />}{order.channel === 'onsite' ? 'Onsite' : 'Online'}
                      </span>
                    </td>
                    <td data-label="Branch" className="branch-cell branch-column">
                      <span title={order.branchName || 'Unassigned branch'}>{order.branchName || 'Unassigned branch'}</span>
                    </td>
                    <td data-label="Items" className="items-cell" title={fullItemsSummary}>
                      <span className="admin-order-items-summary">
                        <span className="admin-order-items-first">{getFirstOrderItemSummary(order.items)}</span>
                        {order.items && order.items.length > 1 && <span className="admin-order-items-more">+{order.items.length - 1} more</span>}
                      </span>
                    </td>
                    <td data-label="Total" className="total-cell">
                      <span>{formatCurrency(order.total || 0)}</span>
                    </td>
                    <td data-label="Status" className="status-cell">
                      <div>
                        <StatusBadge status={statusLabels[order.status] || order.status} />
                        {isScheduledOrder(order) && (
                          <span className="admin-order-scheduled" title={getScheduledDisplay(order)}>
                            <CalendarDays size={12} />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Date" className="date-cell">
                      <AdminDate value={orderDate} />
                    </td>
                    <td data-label="View" className="action-cell">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setSelectedOrder(order); }}
                        title="View order details"
                        className="admin-order-view"
                      >
                        <Eye size={14} aria-hidden="true" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="admin-orders-mobile-list">
            {paginatedOrders.map((order) => {
              const orderId = String(order.order_number || order.id || '');
              const fullItemsSummary = getFullItemsSummary(order.items);
              return (
                <article key={order.id} className="admin-order-card">
                  <div className="admin-order-card-heading">
                    <span className="admin-order-card-id" title={orderId}>{getCompactOrderId(orderId)}</span>
                    <StatusBadge status={statusLabels[order.status] || order.status} />
                  </div>
                  <div className="admin-order-card-customer">
                    <Avatar name={order.customerName || order.email || 'Guest'} className="size-9" />
                    <div className="min-w-0">
                      <p className="customer-name">{order.customerName || order.email || 'Guest'}</p>
                      {order.email && order.customerName && <p className="customer-email" title={order.email}>{order.email}</p>}
                    </div>
                  </div>
                  <p className="admin-order-card-items" title={fullItemsSummary}>
                    <span>{getFirstOrderItemSummary(order.items)}</span>
                    {order.items && order.items.length > 1 && <span className="admin-order-items-more">+{order.items.length - 1} more</span>}
                  </p>
                  <div className="admin-order-card-footer">
                    <div><span className="admin-order-card-label">Total</span><strong>{formatCurrency(order.total || 0)}</strong></div>
                    <div><span className="admin-order-card-label">Date</span><AdminDate value={getOrderDate(order)} /></div>
                  </div>
                  <button type="button" onClick={() => setSelectedOrder(order)} className="admin-order-view admin-order-card-view">
                    <Eye size={14} aria-hidden="true" /> View order
                  </button>
                </article>
              );
            })}
          </div>
          <footer className="admin-orders-pagination">
            <span>Showing <strong>{filteredOrders.length ? (currentPage - 1) * rowsPerPage + 1 : 0}-{Math.min(currentPage * rowsPerPage, filteredOrders.length)}</strong> of <strong>{filteredOrders.length}</strong></span>
            <div className="admin-orders-page-controls"><span>Rows</span><Select aria-label="Orders per page" value={rowsPerPage} onChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1); }} options={[{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]} className="w-24" />
              <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Prev</button><span className="tabular-nums">{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => page + 1)}>Next</button>
            </div>
          </footer>
        </div>
      )}

      {selectedOrder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedOrder(null); }}
            className="flex h-dvh w-full max-w-[560px] flex-col overflow-hidden border-l border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-6 py-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--oppa-text)]">Order Details</h2>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate font-mono text-xs text-[var(--oppa-text-muted)]">{selectedOrder.order_number || selectedOrder.id}</p>
                  <button
                    type="button"
                    onClick={() => copyOrderId(String(selectedOrder.order_number || selectedOrder.id))}
                    aria-label="Copy order ID"
                    title={copiedOrderId === String(selectedOrder.order_number || selectedOrder.id) ? 'Copied' : 'Copy order ID'}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] transition hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                  >
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <StatusBadge status={statusLabels[selectedOrder.status] || selectedOrder.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
                title="Close order details"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] transition-colors hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="space-y-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Customer</p>
                  <p className="mt-1 text-sm font-medium text-[var(--oppa-text)]">{selectedOrder.customerName || selectedOrder.email || 'Guest'}</p>
                  {selectedOrder.email && (
                    <p className="break-all text-sm text-[var(--oppa-text-muted)]">{selectedOrder.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Channel</p>
                  <p className="mt-1 text-sm font-medium capitalize text-[var(--oppa-text)]">{selectedOrder.channel || 'online'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Payment Method</p>
                  <p className="mt-1 text-sm font-medium text-[var(--oppa-text)]">
                    {formatPaymentMethod(selectedOrder.paymentMethod || selectedOrder.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Status</p>
                  <div className="mt-1"><StatusBadge status={statusLabels[selectedOrder.status] || selectedOrder.status} /></div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Delivery</p>
                  <p className="mt-1 text-sm font-medium capitalize text-[var(--oppa-text)]">{String(selectedOrder.delivery_type || 'standard').replace('_', ' ')}</p>
                </div>
              </div>

              {isScheduledOrder(selectedOrder) && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-700">Scheduled delivery</p>
                  <p className="mt-1 text-sm font-medium text-[var(--oppa-text)]">{getScheduledDisplay(selectedOrder)}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Order Date</p>
                <div className="mt-1 text-sm font-medium text-[var(--oppa-text)]"><AdminDate value={getOrderDate(selectedOrder)} /></div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Delivery Address</p>
                <p className="mt-1 break-words text-sm font-medium text-[var(--oppa-text)]">{selectedOrder.deliveryAddress || 'Onsite / Walk-in'}</p>
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
                    <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Sent <AdminDate value={selectedOrder.delivery_proof_uploaded_at} /></p>
                  )}
                </div>
              )}

              {selectedOrder.phone && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Phone</p>
                  <p className="mt-1 text-sm font-medium text-[var(--oppa-text)]">{selectedOrder.phone}</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--oppa-text-muted)]">Items</p>
                <div className="space-y-2 rounded-xl bg-[var(--oppa-cream)] p-4">
                  {selectedOrder.items?.map((item, index) => {
                    const itemPrice = formatPrice(item.product_price);
                    const itemName = item.product_name || 'Item';
                    const quantity = item.quantity || 1;
                    
                    return (
                      <div key={index} className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--oppa-border)]/30 pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{itemName}</p>
                          <p className="break-words text-xs text-[var(--oppa-text-muted)]">
                            Qty: {quantity}
                            {item.selected_addons && item.selected_addons.length > 0 && (
                              <span className="ml-2">
                                Addons: {item.selected_addons.map((addon) => `${addon.name}${(addon.quantity || 1) > 1 ? ` x${addon.quantity}` : ''}`).join(', ')}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="shrink-0 whitespace-nowrap font-semibold">{formatCurrency(itemPrice * quantity)}</p>
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
        </div>,
        document.body,
      )}
      </div>
            </AdminLayout>
  );
};

export default AdminOrdersPage;
