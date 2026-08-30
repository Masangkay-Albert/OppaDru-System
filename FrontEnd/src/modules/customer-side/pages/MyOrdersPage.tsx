import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, FiSearch, FiX, FiChevronDown, FiCalendar, FiClock, 
  FiHash, FiChevronRight, FiPackage, FiShoppingBag, FiCheckCircle, FiTrash2 
} from 'react-icons/fi';
import { FaClipboardList, FaCheck, FaStore } from 'react-icons/fa';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import { formatCurrency } from '../../../utils/formatters';
import { orderService } from '../../../services/orderService';
import { STATUS_DISPLAY, STATUS_OPTIONS, getStatusColor, formatOrderDate, formatOrderTime, getScheduledOrderDetails } from '../../../utils/orderUtils';

const ORDER_EDIT_WINDOW_SECONDS = 20;

const normalizeOrderStatus = (status?: string) => (status ?? '').toString().trim().toLowerCase();

const getOrderCreatedAtMs = (order: any) => {
  if (Number.isFinite(order?.graceStartedAt) && order.graceStartedAt > 0) return order.graceStartedAt;
  const rawTimestamp = order?.timestamp ?? order?.created_at ?? order?.createdAt ?? order?.updated_at ?? order?.updatedAt ?? 0;
  const parsedTimestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
};

const getGraceStartedAt = (order: any) => {
  const createdAt = getOrderCreatedAtMs(order);
  return createdAt > 0 ? createdAt : Date.now();
};

const getRemainingEditSeconds = (order: any, graceStartedAtByOrder?: Record<string, number>) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.PENDING) return 0;

  const startedAt = graceStartedAtByOrder?.[order.id] ?? getGraceStartedAt(order);
  const elapsed = (Date.now() - startedAt) / 1000;
  return Math.max(0, ORDER_EDIT_WINDOW_SECONDS - elapsed);
};

const canManageOrder = (order: any, graceStartedAtByOrder?: Record<string, number>) => {
  if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.PENDING) return false;
  return getRemainingEditSeconds(order, graceStartedAtByOrder) > 0;
};

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { orders, refreshOrders } = useOrder();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(ORDER_STATUS.PENDING);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState<any[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [, setTick] = useState(Date.now());
  const [graceStartedAtByOrder, setGraceStartedAtByOrder] = useState<Record<string, number>>({});

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = getOrderCreatedAtMs(a);
      const dateB = getOrderCreatedAtMs(b);
      return dateB - dateA;
    });
  }, [orders]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const pendingOrders = sortedOrders.filter(order => normalizeOrderStatus(order.status) === ORDER_STATUS.PENDING);

    setGraceStartedAtByOrder(prev => {
      const next = { ...prev };

      pendingOrders.forEach(order => {
        const orderId = String(order.id);
        if (!(orderId in next)) {
          next[orderId] = getGraceStartedAt(order);
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
  }, [sortedOrders]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(order => {
      if (normalizeOrderStatus(order.status) === ORDER_STATUS.CANCELLED) return false;

      const scheduleDetails = getScheduledOrderDetails(order);
      const effectiveStatus = scheduleDetails.isScheduled ? ORDER_STATUS.SCHEDULED : order.status;
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = effectiveStatus === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [sortedOrders, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const visibleOrders = orders.filter(o => normalizeOrderStatus(o.status) !== ORDER_STATUS.CANCELLED);
    const total = visibleOrders.length;
    const delivered = visibleOrders.filter(o => o.status === ORDER_STATUS.DELIVERED).length;
    const scheduled = visibleOrders.filter(o => getScheduledOrderDetails(o).isScheduled && o.status !== ORDER_STATUS.DELIVERED).length;
    return { total, delivered, active: total - delivered, scheduled };
  }, [orders]);

  const currentStatus = STATUS_OPTIONS.find(opt => opt.value === filterStatus) ?? STATUS_OPTIONS[0];

  const handleTrackOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/tracking', { state: { orderId } });
  };

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCancelOrder = async (order: any) => {
    if (!canManageOrder(order, graceStartedAtByOrder)) return;

    try {
      await orderService.updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
      setGraceStartedAtByOrder({});
      await refreshOrders();
      navigate('/customer/orders', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel this order.';
      console.error(message);
    }
  };

  const openEditOrder = (order: any) => {
    if (!canManageOrder(order, graceStartedAtByOrder)) return;
    setEditingOrder(order);
    setEditDraft(order.items.map((item: any) => ({
      ...item,
      selected_addons: (item.selectedAddons || item.selected_addons || []).map((addon: any) => ({
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
      const selected = current.some((addon: any) => String(addon.id) === String(addonId));
      return {
        ...item,
        selected_addons: selected
          ? current.filter((addon: any) => String(addon.id) !== String(addonId))
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
    const validDraft = editDraft.filter((item: any) => Number(item.quantity || 0) > 0);
    if (validDraft.length === 0) return;

    setIsSavingEdit(true);

    try {
      const payload = validDraft.map((item: any) => ({
        product_id: item.id,
        product_name: item.name,
        product_price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        selected_addons: (item.selected_addons || []).map((addon: any) => ({
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
      navigate('/tracking', { state: { orderId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update this order.';
      window.alert(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customer')}
              className="flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
              <span className="text-sm font-medium">Back to Menu</span>
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <FaClipboardList className="text-xl text-[#2d6a4f]" />
              <h1 className="text-xl font-bold text-[#2d6a4f]">My Orders</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border border-gray-100 text-sm">
            <span className="flex items-center gap-1.5">
              <FiShoppingBag size={15} className="text-gray-400" /> 
              Total: <strong className="text-[#2d6a4f]">{stats.total}</strong>
            </span>
            <span className="w-px h-5 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <FiClock className="text-amber-400" /> 
              Active: <strong className="text-amber-600">{stats.active}</strong>
            </span>
            <span className="w-px h-5 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <FiCheckCircle className="text-emerald-400" /> 
              Delivered: <strong className="text-emerald-600">{stats.delivered}</strong>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 bg-white text-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX size={17} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-gray-300 transition-colors min-w-[140px] justify-between"
            >
              <span>{currentStatus?.label || 'Pending'}</span>
              <FiChevronDown className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 min-w-[140px]">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setFilterStatus(option.value); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      filterStatus === option.value ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="mt-5 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <FiPackage className="text-4xl text-[#2d6a4f]/30 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                {orders.length === 0 
                  ? "You haven't placed any orders yet."
                  : "Try adjusting your search or filter."
                }
              </p>
              {orders.length === 0 && (
                <button 
                  onClick={() => navigate('/customer')} 
                  className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-lg font-medium hover:bg-[#1b4332] transition-colors shadow-md shadow-[#2d6a4f]/20 flex items-center gap-2 mx-auto text-sm"
                >
                  <FaStore size={15} /> Browse Menu
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const scheduleDetails = getScheduledOrderDetails(order);
              const effectiveStatus = scheduleDetails.isScheduled ? ORDER_STATUS.SCHEDULED : order.status;
              const isScheduledOrder = scheduleDetails.isScheduled && order.status !== ORDER_STATUS.DELIVERED;
              const displayStatus = isScheduledOrder ? STATUS_DISPLAY[ORDER_STATUS.SCHEDULED] : (STATUS_DISPLAY[order.status] ?? STATUS_DISPLAY[ORDER_STATUS.PENDING]);
              const isActive = order.status !== ORDER_STATUS.DELIVERED;
              const statusColor = getStatusColor(isScheduledOrder ? ORDER_STATUS.SCHEDULED : effectiveStatus);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${statusColor} border`}>
                          {displayStatus.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">
                              Order #{order.id.slice(-8).toUpperCase()}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${displayStatus.badgeClass} border flex items-center gap-1`}>
                              {displayStatus.icon}
                              {displayStatus.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <FiCalendar size={12} /> {formatOrderDate(order.timestamp || '')}
                            </span>
                            <span className="hidden xs:inline">•</span>
                            <span className="flex items-center gap-1">
                              <FiClock size={12} /> {formatOrderTime(order.timestamp || '')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-auto sm:ml-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-base font-bold text-[#2d6a4f]">{formatCurrency(order.total)}</p>
                        </div>
                        {isActive ? (
                          <div className="w-8 h-8 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f] flex-shrink-0">
                            <FiChevronRight size={18} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 flex-shrink-0">
                            <FaCheck size={15} />
                          </div>
                        )}
                      </div>
                    </div>

                    {isScheduledOrder && (
                      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                          <span aria-hidden="true">🗓</span>
                          <span>Scheduled Order</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Scheduled for</p>
                            <p className="font-semibold text-gray-800">{scheduleDetails.scheduledDate || 'Date not available'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Delivery time</p>
                            <p className="font-semibold text-gray-800">{scheduleDetails.scheduledTime || 'Time not available'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between flex-wrap gap-2 border-t border-orange-100 pt-2 text-xs text-orange-700">
                          <span className="font-medium">Status: Scheduled</span>
                          <span className="text-gray-500">Waiting for scheduled time</span>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 mt-3">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-lg text-xs text-gray-700 border border-gray-100">
                          <span className="font-semibold text-[#2d6a4f]">{item.quantity}x</span>
                          <span className="truncate max-w-[100px]">{item.name}</span>
                        </span>
                      ))}
                      {order.items.length > 3 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-gray-400 bg-gray-50 border border-gray-100">
                          +{order.items.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 mt-2.5">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <FiHash size={12} /> {order.id.slice(0, 12)}...
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="capitalize">
                          {order.paymentMethod?.replace('_', ' ') || 'Cash'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleOrderDetails(order.id)}
                          className="text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1"
                        >
                          {expandedOrderIds[order.id] ? 'Hide Details' : 'View Details'}
                        </button>
                        {isActive ? (
                          <button 
                            onClick={(e) => handleTrackOrder(order.id, e)} 
                            className="text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1"
                          >
                            Track Order <FiChevronRight size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <FaCheck size={12} /> Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {expandedOrderIds[order.id] && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="space-y-3">
                          {order.items.map((item, itemIndex) => {
                            const addonsTotal = (item.selectedAddons || []).reduce((sum, addon) => sum + Number(addon.price || 0), 0);
                            const itemSubtotal = (Number(item.price || 0) * Number(item.quantity || 1)) + addonsTotal;

                            return (
                              <div key={`${order.id}-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <div className="flex justify-between gap-4 text-sm">
                                  <div>
                                    <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                                        {item.selectedAddons.map((addon, addonIndex) => (
                                          <div key={`${item.id}-${addonIndex}`} className="flex justify-between gap-3">
                                            <span>+ {addon.name}</span>
                                            <span>{formatCurrency(Number(addon.price || 0))}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-700">{formatCurrency(itemSubtotal)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {order.status === ORDER_STATUS.PENDING && (() => {
                          const canManageThisOrder = canManageOrder(order, graceStartedAtByOrder);

                          return (
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
                              <div className="text-xs text-gray-500">
                                {canManageThisOrder ? (
                                  <span>
                                    You can cancel or edit this order for {Math.ceil(getRemainingEditSeconds(order, graceStartedAtByOrder))}s
                                  </span>
                                ) : (
                                  <span>Your order has been finalized. Cancellation and editing are no longer available.</span>
                                )}
                              </div>
                              {canManageThisOrder ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOrder(order)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                  >
                                    <FiTrash2 size={12} /> Cancel Order
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditOrder(order)}
                                    className="rounded-lg border border-[#2d6a4f]/30 bg-[#2d6a4f]/5 px-3 py-2 text-xs font-semibold text-[#2d6a4f] hover:bg-[#2d6a4f]/10"
                                  >
                                    Edit Order
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
                          {(() => {
                            const productSubtotal = order.items.reduce((sum, item) => {
                              const addonTotal = (item.selectedAddons || []).reduce((addonSum, addon) => addonSum + Number(addon.price || 0), 0);
                              return sum + ((Number(item.price || 0) * Number(item.quantity || 1)) + addonTotal);
                            }, 0);
                            
                            let deliveryFee = order.deliveryFee ?? 0;
                            const serviceFee = order.serviceFee ?? 0;
                            let priorityFee = order.priorityFee ?? 0;
                            let vat = Number(order.vat ?? 0);

                            if (priorityFee === 0 && order.deliveryType === 'priority') {
                              priorityFee = 99;
                            }

                            if (deliveryFee === 0 && order.total > 0) {
                              const derived = order.total - productSubtotal - serviceFee - priorityFee - vat;
                              deliveryFee = Math.max(0, Number(derived.toFixed(2)));
                            }

                            if (vat === 0 && order.total > 0) {
                              const beforeVat = productSubtotal + deliveryFee + serviceFee + priorityFee;
                              vat = Math.round((order.total - beforeVat) * 100) / 100;
                              if (vat < 0) vat = 0;
                            }
                            
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Product subtotal</span>
                                  <span>{formatCurrency(productSubtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Delivery fee</span>
                                  <span>{formatCurrency(deliveryFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Service fee</span>
                                  <span>{formatCurrency(serviceFee)}</span>
                                </div>
                                {(order.deliveryType === 'priority' || priorityFee > 0) && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Priority fee</span>
                                    <span>{formatCurrency(priorityFee)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-500">VAT</span>
                                  <span>{formatCurrency(vat)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-base text-[#2d6a4f] pt-2 border-t border-gray-100">
                                  <span>Order total</span>
                                  <span>{formatCurrency(order.total)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#2d6a4f]">Edit Order</h3>
                <p className="text-xs text-gray-500">You can still edit this order for {Math.ceil(getRemainingEditSeconds(editingOrder, graceStartedAtByOrder))}s</p>
              </div>
              <button type="button" onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
              {editDraft.map((item: any, itemIndex: number) => (
                <div key={`${item.id}-${itemIndex}`} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">₱{Number(item.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateEditItemQuantity(itemIndex, -1)} className="h-7 w-7 rounded-full border border-gray-200 text-lg">-</button>
                      <span className="min-w-5 text-center text-sm font-medium">{item.quantity || 1}</span>
                      <button type="button" onClick={() => updateEditItemQuantity(itemIndex, 1)} className="h-7 w-7 rounded-full border border-gray-200 text-lg">+</button>
                      <button type="button" onClick={() => removeEditItem(itemIndex)} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">Remove</button>
                    </div>
                  </div>

                  {(item.selected_addons || item.selectedAddons || []).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(item.selected_addons || item.selectedAddons || []).map((addon: any, addonIndex: number) => {
                        const isSelected = (item.selected_addons || []).some((selectedAddon: any) => String(selectedAddon.id) === String(addon.id));
                        return (
                          <label key={`${addon.id || addonIndex}-${addonIndex}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEditAddon(itemIndex, addon.id)}
                                className="h-4 w-4 accent-[#2d6a4f]"
                              />
                              <span>{addon.name}</span>
                            </div>
                            <span className="text-[#e76f51]">+ ₱{Number(addon.price || 0).toFixed(2)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setEditingOrder(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600">Cancel</button>
              <button type="button" onClick={saveEditedOrder} disabled={isSavingEdit || editDraft.length === 0} className="rounded-lg bg-[#2d6a4f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;