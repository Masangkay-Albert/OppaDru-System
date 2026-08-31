import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiX, FiChevronDown, FiPackage, FiShoppingBag, FiCheckCircle, FiClock } from 'react-icons/fi';
import { FaClipboardList, FaStore } from 'react-icons/fa';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import { orderService } from '../../../services/orderService';
import { STATUS_OPTIONS, getScheduledOrderDetails } from '../../../utils/orderUtils';
import {
  canManageOrder,
  getOrderCreatedAtMs,
  normalizeOrderStatus,
} from '../../../utils/orderManagement';
import { OrderCard } from '../components/orders/OrderCard';
import { OrderEditModal } from '../components/orders/OrderEditModal';

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
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={Boolean(expandedOrderIds[order.id])}
                onToggleDetails={toggleOrderDetails}
                onTrack={handleTrackOrder}
                onCancel={handleCancelOrder}
                onEdit={openEditOrder}
                graceStartedAtByOrder={graceStartedAtByOrder}
              />
            ))
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

export default MyOrdersPage;