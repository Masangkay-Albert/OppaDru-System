import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiPackage } from 'react-icons/fi';
import { FaClipboardList, FaStore } from 'react-icons/fa';
import { useOrder } from '../../../contexts/OrderContext';
import { useCart } from '../../../contexts/CartContext';
import { useStoreHours } from '../../../contexts/StoreHoursContext';
import type { Order } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import { orderService } from '../../../services/orderService';
import { getCustomerOrderGroup } from '../../../utils/orderUtils';
import {
  canCancelOrder,
  canManageOrder,
  getOrderCreatedAtMs,
  getOrderCancellationRemainingSeconds,
  normalizeOrderStatus,
} from '../../../utils/orderManagement';
import { OrderCard } from '../components/orders/OrderCard';
import { OrderEditModal } from '../components/orders/OrderEditModal';
import SearchInput from '../../../components/ui/SearchInput';
import { setSelectedBranchId } from '../../../services/franchiseBranchService';
import '../../../styles/secondary-pages.css';
import { useToast } from '../components/ToastProvider';

type EditableOrderItem = Order['items'][number] & {
  selected_addons?: NonNullable<Order['items'][number]['selectedAddons']>;
  special_instructions?: string | null;
};

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orders, refreshOrders, isLoading } = useOrder();
  const { addToCart, setActiveBranchId } = useCart();
  const { status: storeHours } = useStoreHours();
  const orderingClosed = storeHours?.state === 'last_order_passed';
  const { showToast, confirmDialog, dismissDialog } = useToast();
  const requestedTab = searchParams.get('tab');
  const filterStatus = requestedTab === 'active' || requestedTab === 'delivered' || requestedTab === 'cancelled'
    ? requestedTab
    : 'all';
  const searchTerm = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editDraft, setEditDraft] = useState<EditableOrderItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [tick, setTick] = useState(0);
  const [graceStartedAtByOrder, setGraceStartedAtByOrder] = useState<Record<string, number>>({});
  const [confirmingCancellationOrderId, setConfirmingCancellationOrderId] = useState<string | null>(null);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = getOrderCreatedAtMs(a);
      const dateB = getOrderCreatedAtMs(b);
      return dateB - dateA;
    });
  }, [orders]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setTick(Date.now()), 0);
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!confirmingCancellationOrderId) return;
    const order = orders.find((candidate) => candidate.id === confirmingCancellationOrderId);
    if (!order || normalizeOrderStatus(order.status) === ORDER_STATUS.PENDING) return;

    const timer = window.setTimeout(() => {
      dismissDialog();
      setConfirmingCancellationOrderId(null);
      showToast('This order has already started and can no longer be cancelled.', 'warning');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [confirmingCancellationOrderId, orders, dismissDialog, showToast]);

  useEffect(() => {
    const pendingOrders = sortedOrders.filter(order => normalizeOrderStatus(order.status) === ORDER_STATUS.PENDING);

    const timer = window.setTimeout(() => {
      setGraceStartedAtByOrder(prev => {
        const next = { ...prev };

        pendingOrders.forEach(order => {
          const orderId = String(order.id);
          if (!(orderId in next)) {
            next[orderId] = getOrderCreatedAtMs(order) || Date.now();
          }
        });

        Object.keys(next).forEach(key => {
          const hasPendingOrder = pendingOrders.some(order => String(order.id) === String(key));
          if (!hasPendingOrder) {
            delete next[key];
          }
        });

        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sortedOrders]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(order => {
      const orderIdentifier = String(order.orderNumber || order.id).toLowerCase();
      const branchName = String(order.branchName || order.branch_name || order.branch?.name || '').toLowerCase();
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch = !query
        || orderIdentifier.includes(query)
        || String(order.id).toLowerCase().includes(query)
        || branchName.includes(query)
        || order.items.some(item => String(item.name || '').toLowerCase().includes(query));
      const matchesFilter = filterStatus === 'all' || getCustomerOrderGroup(order) === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [sortedOrders, searchTerm, filterStatus]);

  const tabCounts = useMemo(() => ({
    all: sortedOrders.length,
    active: sortedOrders.filter(order => getCustomerOrderGroup(order) === 'active').length,
    delivered: sortedOrders.filter(order => getCustomerOrderGroup(order) === 'delivered').length,
    cancelled: sortedOrders.filter(order => getCustomerOrderGroup(order) === 'cancelled').length,
  }), [sortedOrders]);
  const visibleOrders = filteredOrders.slice(0, page * 10);
  const dateGroups = useMemo(() => {
    if (filteredOrders.length <= 10) return [{ label: '', orders: visibleOrders }];
    const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    if (!tick) return [{ label: '', orders: visibleOrders }];
    const today = dateKey(new Date(tick));
    const yesterday = dateKey(new Date(tick - 24 * 60 * 60 * 1000));
    const groups = new Map<string, typeof visibleOrders>();
    visibleOrders.forEach((order) => {
      const timestamp = getOrderCreatedAtMs(order);
      const key = timestamp ? dateKey(new Date(timestamp)) : '';
      const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : 'Earlier';
      groups.set(label, [...(groups.get(label) || []), order]);
    });
    return ['Today', 'Yesterday', 'Earlier']
      .filter(label => groups.has(label))
      .map(label => ({ label, orders: groups.get(label) || [] }));
  }, [filteredOrders, tick, visibleOrders]);

  const updateQuery = (updates: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace });
  };

  const handleTabChange = (tab: string) => {
    updateQuery({ tab: tab === 'all' ? null : tab, page: null });
  };

  const handleSearchChange = (value: string) => {
    updateQuery({ q: value.trim() ? value : null, page: null }, true);
  };

  const handleLoadMore = () => updateQuery({ page: String(page + 1) });

  const handleTrackOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders/${encodeURIComponent(orderId)}/track`);
  };

  const handleReorder = (order: Order) => {
    if (orderingClosed) {
      showToast(storeHours?.order_closed_message || 'Store availability is temporarily unavailable.', 'warning');
      return;
    }

    const branchId = order.branchId ? String(order.branchId) : '';
    if (!branchId) {
      showToast('This order is missing its branch information, so it cannot be reordered.', 'error');
      return;
    }
    setSelectedBranchId(branchId);
    setActiveBranchId(branchId);
    order.items.forEach((item) => {
      addToCart({ ...item, quantity: Math.max(1, Number(item.quantity) || 1) });
    });
    showToast(`Items from ${order.branchName || order.branch_name || order.branch?.name || 'this branch'} were added to your cart.`, 'success');
    navigate('/customer');
  };

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCancelOrder = async (order: Order) => {
    if (!canCancelOrder(order)) {
      showToast('Cancellation period has ended.', 'warning');
      return;
    }

    setConfirmingCancellationOrderId(order.id);
    const remainingMs = getOrderCancellationRemainingSeconds(order) * 1000;
    const expiryTimer = window.setTimeout(() => {
      dismissDialog();
      setConfirmingCancellationOrderId(null);
      showToast('Cancellation period has ended.', 'warning');
    }, remainingMs);
    try {
      const confirmed = await confirmDialog({
        title: 'Cancel this order?',
        message: 'This will cancel your order and notify the branch.',
        cancelLabel: 'Keep Order',
        confirmLabel: 'Yes, Cancel',
        danger: true,
      });
      if (!confirmed || !canCancelOrder(order)) {
        if (confirmed) showToast('Cancellation period has ended.', 'warning');
        return;
      }

      await orderService.updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
      showToast('Order cancelled successfully.', 'success');
      await refreshOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel this order.';
      showToast(message, 'error');
    } finally {
      window.clearTimeout(expiryTimer);
      setConfirmingCancellationOrderId(null);
    }
  };

  const openEditOrder = (order: Order) => {
    if (!canManageOrder(order, graceStartedAtByOrder)) return;
    setEditingOrder(order);
    setEditDraft(order.items.map((item) => ({
      ...item,
      selected_addons: (item.selectedAddons || []).map((addon) => ({
        id: addon.id,
        name: addon.name,
        price: Number(addon.price || 0),
        quantity: Number(addon.quantity || 1),
      })),
    })));
  };

  const toggleEditAddon = (itemIndex: number, addonId: string | undefined) => {
    if (!addonId) return;

    setEditDraft(prev => prev.map((item, index) => {
      if (index !== itemIndex) return item;
      const current = item.selected_addons || [];
      const selected = current.some((addon) => String(addon.id) === String(addonId));
      return {
        ...item,
        selected_addons: selected
          ? current.filter((addon) => String(addon.id) !== String(addonId))
          : [...current, { id: addonId, name: addonId, price: 0, quantity: 1 }],
      };
    }));
  };

  const updateEditItemQuantity = (itemIndex: number, delta: number) => {
    setEditDraft(prev => prev.flatMap((item, index) => {
      if (index !== itemIndex) return [item];
      const nextQuantity = Number(item.quantity || 1) + delta;
      if (nextQuantity <= 0) return [];
      return [{ ...item, quantity: nextQuantity }];
    }));
  };

  const removeEditItem = (itemIndex: number) => {
    setEditDraft(prev => prev.filter((_, index) => index !== itemIndex));
  };

  const saveEditedOrder = async () => {
    if (!editingOrder) return;
    const validDraft = editDraft.filter(item => Number(item.quantity || 0) > 0);
    if (validDraft.length === 0) return;

    setIsSavingEdit(true);

    try {
      const payload = validDraft.map(item => ({
        product_id: item.id,
        product_name: item.name,
        product_price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        selected_addons: (item.selected_addons || []).map((addon) => ({
          id: addon.id,
          name: addon.name,
          price: Number(addon.price || 0),
          quantity: Number(addon.quantity || 1),
        })),
        special_instructions: item.specialInstructions || item.special_instructions || null,
      }));

      await orderService.updateOrder(editingOrder.id, {
        items: payload,
        delivery_address: editingOrder.address || editingOrder.deliveryAddress,
        phone: editingOrder.phone || '',
        delivery_type: editingOrder.deliveryType || 'standard',
      });

      await refreshOrders();
      const orderId = editingOrder.id;
      setEditingOrder(null);
      setEditDraft([]);
      navigate(`/orders/${encodeURIComponent(orderId)}/track`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update this order.';
      showToast(message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="secondary-page secondary-orders min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="secondary-page-container orders-page-container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="secondary-page-header orders-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customer')}
              className="back-menu-button flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
              <span className="text-sm font-medium">Back to Menu</span>
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <FaClipboardList className="text-xl text-[#2d6a4f]" />
              <h1 className="secondary-page-title text-xl font-bold text-[#2d6a4f]">My Orders</h1>
            </div>
          </div>
          
        </div>

        {/* Filters */}
        <div className="orders-toolbar">
          <SearchInput
            aria-label="Search orders"
            placeholder="Search order ID, item, or branch..."
            value={searchTerm}
            onChange={handleSearchChange}
            debounceMs={0}
            wrapperClassName="orders-search"
          />
          <div className="orders-filter-tabs" role="tablist" aria-label="Filter orders by status">
            {([
              ['all', 'All'],
              ['active', 'Active'],
              ['delivered', 'Delivered'],
              ['cancelled', 'Cancelled'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={filterStatus === tab}
                onClick={() => handleTabChange(tab)}
                className={`orders-filter-tab${filterStatus === tab ? ' is-selected' : ''}`}
              >
                {label}<span>{tabCounts[tab]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="orders-list mt-5">
          {isLoading && filteredOrders.length === 0 ? (
            <div role="status" aria-label="Loading orders" className="orders-skeleton-list">
              {Array.from({ length: 3 }, (_, index) => <OrderCardSkeleton key={index} />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-empty-state">
              <FiPackage className="text-4xl text-[#2d6a4f]/30 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {searchTerm
                  ? 'No matching orders'
                  : orders.length === 0
                    ? 'No orders yet'
                    : `No ${filterStatus === 'all' ? '' : filterStatus + ' '}orders`}
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                {searchTerm
                  ? 'Try another order ID, item name, or branch.'
                  : orders.length === 0
                    ? "You haven't placed any orders yet."
                    : `You don't have any ${filterStatus === 'all' ? '' : filterStatus + ' '}orders right now.`}
              </p>
              <button
                  onClick={() => navigate('/customer')} 
                  className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-lg font-medium hover:bg-[#1b4332] transition-colors shadow-md shadow-[#2d6a4f]/20 flex items-center gap-2 mx-auto text-sm"
                >
                  <FaStore size={15} /> Browse Menu
              </button>
            </div>
          ) : (
            <>
              {dateGroups.map(({ label, orders: groupOrders }) => (
                <section key={label || 'orders'} className="orders-date-group">
                  {label && <h2 className="orders-date-heading">{label}</h2>}
                  <div className="orders-date-cards">
                    {groupOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        isExpanded={Boolean(expandedOrderIds[order.id])}
                        onToggleDetails={toggleOrderDetails}
                        onTrack={handleTrackOrder}
                        onCancel={handleCancelOrder}
                        onEdit={openEditOrder}
                        onReorder={handleReorder}
                        orderingClosed={orderingClosed}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {visibleOrders.length < filteredOrders.length && (
                <button type="button" className="orders-load-more" onClick={handleLoadMore}>
                  Load more orders
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <OrderEditModal
        editingOrder={editingOrder}
        graceStartedAtByOrder={graceStartedAtByOrder}
        editDraft={editDraft}
        isSavingEdit={isSavingEdit}
        onClose={() => setEditingOrder(null)}
        onSave={saveEditedOrder}
        onToggleAddon={toggleEditAddon}
        onUpdateQuantity={updateEditItemQuantity}
        onRemoveItem={removeEditItem}
      />
    </div>
  );
};

const OrderCardSkeleton: React.FC = () => (
  <div className="order-card-skeleton" aria-hidden="true">
    <div className="order-skeleton-row">
      <span className="order-skeleton-block order-skeleton-title" />
      <span className="order-skeleton-block order-skeleton-badge" />
      <span className="order-skeleton-block order-skeleton-total" />
    </div>
    <span className="order-skeleton-block order-skeleton-meta" />
    <div className="order-skeleton-items">
      <span className="order-skeleton-block" />
      <span className="order-skeleton-block" />
      <span className="order-skeleton-block" />
    </div>
    <span className="order-skeleton-block order-skeleton-actions" />
  </div>
);

export default MyOrdersPage;
