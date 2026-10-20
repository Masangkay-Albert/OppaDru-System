import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, X, Eye, Package, CalendarDays, Copy, Search, Globe2, Store, Printer } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AdminDate, Avatar, EmptyState, PageHeader, StatusBadge, Toast } from '../components/AdminUI';
import { getAllOrders, markOrderServed, type AdminOrder } from '../../../services/adminOrderService';
import POSReceiptModal from '../../employee-side/components/pos/POSReceiptModal';
import { formatCurrency } from '../../../utils/formatters';
import { getScheduledOrderDetails } from '../../../utils/orderUtils';

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
  const [printingOrder, setPrintingOrder] = useState<AdminOrder | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'onsite'>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);
  const [copiedOrderId, setCopiedOrderId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [notice, setNotice] = useState('');
  const routeOrderId = useRef((location.state as { orderId?: string } | null)?.orderId);

  const loadOrders = useCallback(async (forceRefresh = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const allOrders = await getAllOrders(forceRefresh);
      const freshOrders = Array.isArray(allOrders) ? allOrders : [];
      setOrders(freshOrders);
      setSelectedOrder((current) => current
        ? freshOrders.find((order) => order.id === current.id) || current
        : freshOrders.find((order) => order.id === routeOrderId.current) || null
      );
      if (routeOrderId.current && freshOrders.some((order) => order.id === routeOrderId.current)) {
        routeOrderId.current = undefined;
        navigate(location.pathname, { replace: true, state: null });
      }
    } catch {
      if (showLoading) setOrders([]);
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

  const handleMarkDelivered = async (order: AdminOrder) => {
    try {
      await markOrderServed(order.id, order.channel);
      await loadOrders();
    } catch (error) {
      console.error('Could not mark order delivered:', error);
      setNotice('Could not update the order status.');
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
      if (branchFilter !== 'all' && (order.branchId || '') !== branchFilter) return false;

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
  }, [orders, channelFilter, branchFilter, statusFilter, dateFilter, sortOrder, searchTerm]);

  const branches = useMemo(() => Array.from(new Map(orders.map((order) => [order.branchId || 'unassigned', { id: order.branchId || 'unassigned', name: order.branchName || 'Unassigned branch' }])).values()), [orders]);

  const statusTabs = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'On the way', value: 'on_the_way' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];
  const statusCounts = (status: string) => orders.filter((order) => status === 'all' || String(order.status).toLowerCase() === status).length;

  const handleClearFilters = () => {
    setChannelFilter('all');
    setBranchFilter('all');
    setStatusFilter('all');
    setDateFilter('');
    setSortOrder('desc');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const hasActiveFilters = channelFilter !== 'all' || branchFilter !== 'all' || dateFilter !== '' || searchTerm !== '';
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));

  const copyOrderId = (orderId: string) => {
    if (!navigator.clipboard) {
      setNotice('Copying order IDs is not supported by this browser.');
      return;
    }
    void navigator.clipboard.writeText(orderId).then(() => { setCopiedOrderId(orderId); setNotice('Order ID copied.'); }).catch((error: unknown) => { console.error('Failed to copy order ID:', error); setNotice('Could not copy order ID.'); });
  };

  const getOrderItemsSummary = (items: Array<{ quantity?: number; product_name?: string; name?: string }> | undefined) => {
    if (!items || items.length === 0) return 'No items';
    const first = `${items[0].quantity || 1}x ${items[0].product_name || items[0].name || 'Item'}`;
    return items.length > 1 ? `${first} +${items.length - 1} more` : first;
  };

  const getFullItemsSummary = (items: Array<{ quantity?: number; product_name?: string; name?: string }> | undefined) =>
    !items?.length ? 'No items' : items.map((item) => `${item.quantity || 1}x ${item.product_name || item.name || 'Item'}`).join(', ');

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
      {notice && <Toast message={notice} tone={notice.startsWith('Could') || notice.startsWith('Copying') ? 'error' : 'success'} onDismiss={() => setNotice('')} />}
      <PageHeader title="Orders" subtitle="Track online and onsite orders in real time." />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Filter orders by status" className="relative flex gap-2 overflow-x-auto pb-1">
        {statusTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={statusFilter === tab.value} onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${statusFilter === tab.value ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white shadow-sm' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]'}`}>{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === tab.value ? 'bg-white/20' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'}`}>{statusCounts(tab.value)}</span></button>)}
      </div>
      <span className="text-xs text-[var(--oppa-text-muted)]">Showing <strong className="tabular-nums text-[var(--oppa-text)]">{filteredOrders.length}</strong> of <strong className="tabular-nums text-[var(--oppa-text)]">{orders.length}</strong> orders</span></div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-sm sm:flex-row">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)]"><Search size={16} /><input aria-label="Search orders by ID, customer, or email" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }} placeholder="Search order ID, customer, email…" className="admin-embedded-input min-w-0 w-full text-sm text-[var(--oppa-text)]" /></label>
          <select aria-label="Filter by channel" value={channelFilter} onChange={(event) => { setChannelFilter(event.target.value as 'all' | 'online' | 'onsite'); setCurrentPage(1); }} className="h-11 min-w-36 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]"><option value="all">All channels</option><option value="online">Online</option><option value="onsite">Onsite</option></select>
          <select aria-label="Filter by branch" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setCurrentPage(1); }} className="h-11 min-w-44 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]"><option value="all">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
          <input aria-label="Filter by exact date" type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} className="h-11 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]" />
          {hasActiveFilters && <button type="button" onClick={handleClearFilters} className="h-11 rounded-xl px-3 text-sm font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">Clear filters</button>}
        </div>
        {(searchTerm || channelFilter !== 'all' || branchFilter !== 'all' || dateFilter) && <div className="flex flex-wrap gap-2 text-xs">{searchTerm && <span className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-[var(--oppa-green-dark)]">Search: {searchTerm}</span>}{channelFilter !== 'all' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">Channel: {channelFilter}</span>}{branchFilter !== 'all' && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-900">Branch: {branches.find((branch) => branch.id === branchFilter)?.name || branchFilter}</span>}{dateFilter && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-800">Date: {dateFilter}</span>}</div>}
      </div>

      {loading ? (
        <div aria-label="Loading orders" aria-busy="true" className="admin-card animate-pulse space-y-3 p-5">
          {[0, 1, 2, 3].map((row) => <div key={row} className="admin-skeleton h-14 rounded-xl" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="admin-card">
          <EmptyState icon={<Package size={23} />} title={hasActiveFilters ? 'No orders match these filters' : 'No orders yet'} description={hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'New orders will appear here as customers place them.'} action={hasActiveFilters ? <button type="button" onClick={handleClearFilters} className="mt-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Clear filters</button> : undefined} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <table className="admin-table w-full table-fixed text-left text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
                <th className="w-[14%] min-w-52 px-3 py-3 font-semibold">Order ID</th>
                <th className="w-[16%] px-3 py-3 font-semibold">Customer</th>
                <th className="w-[9%] px-3 py-3 font-semibold">Channel</th>
                <th className="w-[14%] px-3 py-3 font-semibold">Branch</th>
                <th className="w-[16%] px-3 py-3 font-semibold">Items</th>
                <th className="w-[13%] px-7 py-3 text-right font-semibold"><span className="mr-5 inline-block">Total</span></th>
                <th className="w-[14%] px-7 py-3 font-semibold"><span className="ml-5 inline-block">Status</span></th>
                <th className="w-[11%] px-3 py-3 font-semibold">
                  <button type="button" onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="inline-flex items-center gap-1 font-semibold hover:text-[var(--oppa-green-dark)]" aria-label={`Sort date ${sortOrder === 'desc' ? 'oldest first' : 'newest first'}`}>Date <span aria-hidden="true">{sortOrder === 'desc' ? '↓' : '↑'}</span></button>
                </th>
                <th className="w-[7%] px-2 py-3 text-right font-semibold">View</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const isDelivered = order.status === 'delivered';
                const itemsSummary = getOrderItemsSummary(order.items);
                const fullItemsSummary = getFullItemsSummary(order.items);
                const orderDate = getOrderDate(order);
                const orderId = String(order.order_number || order.id || '');

                return (
                  <tr
                    key={order.id}
                    tabIndex={0}
                    onClick={(event) => {
                      if (!(event.target instanceof Element) || !event.target.closest('button, a')) setSelectedOrder(order);
                    }}
                    onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) setSelectedOrder(order); }}
                    className="group cursor-pointer border-b border-[var(--oppa-border)]/60 last:border-0 transition hover:bg-[var(--oppa-cream)]/50"
                  >
                    <td data-label="Order ID" className="min-w-52 whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-[var(--oppa-text)]" title={orderId}>
                      <span>{orderId}</span>
                      <button type="button" aria-label={`Copy order ID ${orderId}`} title={copiedOrderId === orderId ? 'Copied' : 'Copy order ID'} onClick={(event) => { event.stopPropagation(); copyOrderId(orderId); }} className="ml-1 inline-flex rounded-md p-1 text-[var(--oppa-text-muted)] opacity-0 transition-opacity hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-green-dark)] group-hover:opacity-100 focus-visible:opacity-100"><Copy size={13} /></button>
                    </td>
                    <td data-label="Customer" className="px-3 py-2.5 min-w-0">
                      <div className="flex min-w-0 items-center gap-2" title={order.customerName || order.email || 'Guest'}>
                        <Avatar name={order.customerName || order.email || 'Guest'} className="size-8" />
                        <div className="min-w-0"><p className="truncate font-medium text-xs text-[var(--oppa-text)]">
                          {(order.customerName || order.email || 'Guest').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}
                        </p>
                        {order.email && order.customerName && (
                          <p className="truncate text-[11px] text-[var(--oppa-text-muted)]">{order.email}</p>
                        )}</div>
                      </div>
                    </td>
                    <td data-label="Channel" className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        order.channel === 'onsite' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {order.channel === 'onsite' ? <Store size={12} /> : <Globe2 size={12} />}{order.channel === 'onsite' ? 'Onsite' : 'Online'}
                      </span>
                    </td>
                    <td data-label="Branch" className="px-3 py-2.5">
                      <span className="block truncate text-xs font-medium text-[var(--oppa-text)]" title={order.branchName || 'Unassigned branch'}>{order.branchName || 'Unassigned branch'}</span>
                    </td>
                    <td data-label="Items" className="px-3 py-2.5 min-w-0">
                      <p className="truncate text-xs text-[var(--oppa-text-muted)]" title={fullItemsSummary}>
                        {itemsSummary}
                      </p>
                    </td>
                    <td data-label="Total" className="tabular-nums whitespace-nowrap px-7 py-2.5 text-right text-xs font-semibold text-[var(--oppa-text)]">
                      <div className="mr-5">{formatCurrency(order.total || 0)}</div>
                    </td>
                    <td data-label="Status" className="px-7 py-2.5">
                      <div className="ml-5 flex flex-col gap-1 items-start">
                        <StatusBadge status={statusLabels[order.status] || order.status} />
                        {isScheduledOrder(order) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 whitespace-nowrap" title={getScheduledDisplay(order)}>
                            <CalendarDays className="h-2.5 w-2.5 flex-shrink-0" />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Date" className="px-3 py-2.5 whitespace-nowrap text-xs">
                      <AdminDate value={orderDate} />
                    </td>
                    <td data-label="View" className="px-2 py-2.5 text-right whitespace-nowrap">
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
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--oppa-border)]/60 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100"
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
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--oppa-border)] px-4 py-3 text-xs text-[var(--oppa-text-muted)]">
            <span>Showing <strong className="tabular-nums text-[var(--oppa-text)]">{filteredOrders.length ? (currentPage - 1) * rowsPerPage + 1 : 0}-{Math.min(currentPage * rowsPerPage, filteredOrders.length)}</strong> of <strong className="tabular-nums text-[var(--oppa-text)]">{filteredOrders.length}</strong></span>
            <div className="flex items-center gap-2"><label htmlFor="orders-page-size">Rows</label><select id="orders-page-size" value={rowsPerPage} onChange={(event) => { setRowsPerPage(Number(event.target.value)); setCurrentPage(1); }} className="h-8 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>
              <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-lg border border-[var(--oppa-border)] px-2.5 py-1.5 disabled:opacity-40">Prev</button><span className="tabular-nums">{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-lg border border-[var(--oppa-border)] px-2.5 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </footer>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" onClick={() => setSelectedOrder(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedOrder(null); }}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 -mx-5 mb-5 flex items-start justify-between border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-5 py-4 sm:-mx-7 sm:px-7">
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">Order Details</h2>
                <p className="truncate font-mono text-xs text-[var(--oppa-text-muted)]">{selectedOrder.order_number || selectedOrder.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintingOrder(selectedOrder)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--oppa-border)] bg-white text-xs font-bold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)] transition shadow-xs"
                  title="Print Thermal Receipt"
                >
                  <Printer size={15} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                  title="Close order details"
                  className="ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--oppa-border)] bg-white text-[var(--oppa-text)] shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
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
                  <StatusBadge status={statusLabels[selectedOrder.status] || selectedOrder.status} />
                </div>
                <div>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Delivery</p>
                  <p className="font-medium capitalize">{String(selectedOrder.delivery_type || 'standard').replace('_', ' ')}</p>
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
                <AdminDate value={getOrderDate(selectedOrder)} />
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
                    <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Sent <AdminDate value={selectedOrder.delivery_proof_uploaded_at} /></p>
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
                  {selectedOrder.items?.map((item, index) => {
                    const itemPrice = formatPrice(item.product_price);
                    const itemName = item.product_name || 'Item';
                    const quantity = item.quantity || 1;
                    
                    return (
                      <div key={index} className="flex items-center justify-between border-b border-[var(--oppa-border)]/30 pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{itemName}</p>
                          <p className="text-xs text-[var(--oppa-text-muted)]">
                            Qty: {quantity}
                            {item.selected_addons && item.selected_addons.length > 0 && (
                              <span className="ml-2">
                                Addons: {item.selected_addons.map((addon) => `${addon.name}${(addon.quantity || 1) > 1 ? ` x${addon.quantity}` : ''}`).join(', ')}
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
      {printingOrder && (
        <POSReceiptModal
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </AdminLayout>
  );
};

export default AdminOrdersPage;
