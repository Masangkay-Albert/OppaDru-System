import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPackage, FiShoppingBag, FiCheckCircle, FiClock, FiPlus } from 'react-icons/fi';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import { OrderCard } from '../components/orders/OrderCard';
import POSReceiptModal from '../components/pos/POSReceiptModal';
import { getOnsiteOrders, fetchOnsiteOrders, markOrderServed, removeOrder, type AdminOrder } from '../../../services/adminOrderService';
import SearchInput from '../../../components/ui/SearchInput';

const EmployeeOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'preparing' | 'prepared' | 'delivered'>('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<AdminOrder | null>(null);

  const loadOnsiteOrders = useCallback(() => {
    const list = getOnsiteOrders();
    setOrders(list.sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return timeB - timeA;
    }));

    fetchOnsiteOrders().then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        setOrders(fresh);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadOnsiteOrders();
    const handleUpdate = () => loadOnsiteOrders();
    window.addEventListener('onsite-orders-updated', handleUpdate);
    return () => window.removeEventListener('onsite-orders-updated', handleUpdate);
  }, [loadOnsiteOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch =
        (order.order_number || order.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customerName || order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => (item.name || (item as any).product_name || '').toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === 'all') return true;
      if (filterStatus === 'delivered') return order.status === 'delivered' || order.served;
      if (filterStatus === 'prepared') return (order.status === 'prepared' || order.status === 'ready') && !order.served;
      return order.status === filterStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const total = orders.length;
    const preparing = orders.filter(o => o.status === 'preparing' && !o.served).length;
    const prepared = orders.filter(o => (o.status === 'prepared' || o.status === 'ready') && !o.served).length;
    const delivered = orders.filter(o => o.status === 'delivered' || o.served).length;
    return { total, preparing, prepared, delivered };
  }, [orders]);

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleMarkServed = async (orderId: string) => {
    await markOrderServed(orderId, 'onsite');
    loadOnsiteOrders();
  };

  const handleCancelOrder = async (order: AdminOrder) => {
    if (window.confirm(`Are you sure you want to void/cancel order ${order.order_number || order.id}?`)) {
      await removeOrder(order.id, 'onsite');
      loadOnsiteOrders();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarEmployee />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee')}
              className="flex items-center gap-2 text-[#7f4f24] hover:text-[#2d6a4f] transition-all font-medium text-sm bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm hover:shadow-md"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Register Menu</span>
            </button>
            <div className="h-8 w-px bg-[#e76f51]/20"></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2d6a4f]">Onsite Register Orders</h1>
              <p className="text-xs text-gray-500 mt-0.5">Counter walk-in & dine-in orders queue</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/employee')}
            className="flex items-center gap-2 bg-[var(--oppa-green)] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-[var(--oppa-green-dark)] transition self-start sm:self-auto"
          >
            <FiPlus size={16} />
            <span>New Counter Order</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between text-gray-500 mb-1 text-xs font-medium">
              <span>All Onsite</span>
              <FiPackage className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-blue-100 shadow-sm">
            <div className="flex items-center justify-between text-blue-600 mb-1 text-xs font-medium">
              <span>Preparing</span>
              <FiClock className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.preparing}</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-purple-100 shadow-sm">
            <div className="flex items-center justify-between text-purple-600 mb-1 text-xs font-medium">
              <span>Prepared</span>
              <FiShoppingBag className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-700">{stats.prepared}</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 mb-1 text-xs font-medium">
              <span>Served</span>
              <FiCheckCircle className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">{stats.delivered}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <SearchInput
            aria-label="Search orders by number, customer, or item"
            placeholder="Search by order #, customer name, or item..."
            value={searchTerm}
            onChange={setSearchTerm}
            wrapperClassName="flex-1"
          />

          <div className="flex bg-white/90 backdrop-blur-sm p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterStatus === 'all'
                  ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('preparing')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterStatus === 'preparing'
                  ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Preparing ({stats.preparing})
            </button>
            <button
              onClick={() => setFilterStatus('prepared')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterStatus === 'prepared'
                  ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Prepared ({stats.prepared})
            </button>
            <button
              onClick={() => setFilterStatus('delivered')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterStatus === 'delivered'
                  ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Served ({stats.delivered})
            </button>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100">
            <FiShoppingBag className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Onsite Orders Found</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              {searchTerm ? 'No orders match your search criteria.' : 'There are currently no onsite orders in this queue.'}
            </p>
            <button
              onClick={() => navigate('/employee')}
              className="px-6 py-2.5 bg-[var(--oppa-green)] text-white font-semibold rounded-xl text-sm hover:bg-[var(--oppa-green-dark)] transition"
            >
              Create New Order
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={Boolean(expandedOrderIds[order.id])}
                onToggleDetails={toggleOrderDetails}
                onMarkServed={handleMarkServed}
                onCancel={handleCancelOrder}
                onViewReceipt={(ord) => setSelectedReceiptOrder(ord)}
              />
            ))}
          </div>
        )}
      </div>

      <POSReceiptModal
        order={selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
      />
    </div>
  );
};

export default EmployeeOrdersPage;
