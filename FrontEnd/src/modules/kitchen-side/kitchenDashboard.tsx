import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, CheckCircle, Clock, Eye, X, ArrowDownUp, Flame, ClipboardList, ChevronDown } from 'lucide-react';

import { sortOrders } from '../../utils/dashboardOrders';
import { OrderDateTime, StatusBadge, UserChip } from '../shared/components/DashboardPrimitives';
import KitchenLayout from './components/kitchenLayout'; 
import { API_URL } from '../../services/apiConfig'; 

const chipBase = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap motion-reduce:transition-none';
const chipPrimary = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 cursor-pointer`;
const chipSuccess = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 cursor-pointer`;
const chipDisabled = 'inline-flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2 text-[11px] font-medium text-gray-500 whitespace-nowrap cursor-default';

export interface KitchenOrder {
  id: string;
  order_number?: string;
  customerName: string; 
  channel?: 'online' | 'onsite';
  status: string;
  items: any[]; 
  scheduleDisplay?: string;
  deliveryType?: string;
  created_at: string;
}

type TabView = 'pending' | 'preparing' | 'history';
type SortOrder = 'desc' | 'asc';

// Helper function to format the database date into a readable string
const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const KitchenDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('pending');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // 'desc' = Latest, 'asc' = Oldest
  const [staffName, setStaffName] = useState<string>("Kitchen Staff");
  const ordersFetchInFlightRef = useRef(false);
  
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const getDisplayOrderNumber = (order: KitchenOrder) => order.order_number || order.id;

  // Security bouncer
  useEffect(() => {
    const authData = localStorage.getItem("employee_auth");
    const token = localStorage.getItem("employee_token");

    if (!token || !authData) {
      navigate('/staff/login', { replace: true });
      return; 
    }

    try {
      const employee = JSON.parse(authData);
      setStaffName(employee.fullName || employee.name || "Kitchen Staff");
    } catch (error) {
      navigate('/staff/login', { replace: true }); 
    }
  }, [navigate]);

  
  const fetchOrders = async (showLoading = true) => {
    if (ordersFetchInFlightRef.current) return;
    ordersFetchInFlightRef.current = true;
    const requestedTab = activeTab;
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem("employee_token");
      const response = await fetch(`${API_URL}/kitchen/orders?tab=${requestedTab}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      if (requestedTab === activeTab) {
        setOrders((current) => JSON.stringify(current) === JSON.stringify(data) ? current : data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      ordersFetchInFlightRef.current = false;
      if (showLoading && requestedTab === activeTab) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    const interval = window.setInterval(() => {
      void fetchOrders(false);
    }, 5000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Update order status in Laravel API
  const updateOrderStatus = async (orderId: string, newStatus: string, nextTab: TabView) => {
    try {
      const token = localStorage.getItem("employee_token");
      const response = await fetch(`${API_URL}/kitchen/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');

      setActiveTab(nextTab);
      if (activeTab === nextTab) fetchOrders(); 
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update order status. Please try again.");
    }
  };

  // Sort the orders safely, handling missing or weird dates
  const sortedOrders = sortOrders(orders, sortOrder);
  const priorityOrdersCount = sortedOrders.filter((order) => order.deliveryType === 'priority').length;

  return (
    <KitchenLayout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-[var(--oppa-text)] sm:text-4xl">
            Kitchen Dashboard
          </h1>
        </div>
        <div className="pb-1">
          <UserChip name={staffName} />
        </div>
      </div>

      {/* Tabs and Sort Controls */}
      <div className="relative z-20 mb-4 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="inline-flex min-h-10 flex-wrap gap-1 rounded-2xl border border-[var(--oppa-border)] bg-white/70 p-1 shadow-sm">
          {(['pending', 'preparing', 'history'] as TabView[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 ${
                activeTab === tab ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'bg-transparent text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'
              }`}
            >
              {tab === 'pending' ? 'New Orders' : tab === 'preparing' ? 'Currently Preparing' : 'History'}
            </button>
          ))}
        </div>

        {/* Sort Dropdown (Always visible now) */}
        <div className="flex h-10 w-max items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm text-[var(--oppa-text-muted)] shadow-sm ring-1 ring-black/[0.02]">
          <ArrowDownUp size={16} className="text-[var(--oppa-green)]" />
          <span className="font-medium">Sort by:</span>
          <span className="relative inline-flex items-center">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="relative z-20 w-auto cursor-pointer appearance-none bg-transparent py-1 pr-4 font-semibold text-[var(--oppa-text)] outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
          >
            <option value="desc">Latest First</option>
            <option value="asc">Oldest First</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-1 text-[var(--oppa-text-muted)]" />
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading orders...</div>
      ) : sortedOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <ClipboardList className="mx-auto mb-3 text-[var(--oppa-green)]/60" size={30} />
          <p className="font-medium text-[var(--oppa-text)]">
          {activeTab === 'pending' ? 'No new orders to prepare.' 
           : activeTab === 'preparing' ? 'You are not preparing any orders right now.' 
           : 'No completed orders yet.'}
          </p>
          <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Orders will appear here when they are ready for this tab.</p>
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="space-y-2 md:hidden">
            {sortedOrders.map((order, index) => (
              <React.Fragment key={order.id}>
              {index === 0 && priorityOrdersCount > 0 && (
                <p className="py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-800">Priority orders</p>
              )}
              {index === priorityOrdersCount && priorityOrdersCount > 0 && priorityOrdersCount < sortedOrders.length && (
                <p className="pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">Other orders</p>
              )}
              {index === 0 && priorityOrdersCount === 0 && (
                <p className="py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">Other orders</p>
              )}
              <div className={`relative overflow-hidden rounded-2xl border border-[var(--oppa-border)] p-3 shadow-sm transition-shadow motion-reduce:transition-none hover:shadow-md ${order.deliveryType === 'priority' ? 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white' : 'bg-white'}`}>
                {order.deliveryType === 'priority' && (
                  <div className="mb-3 flex w-fit items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-orange-800">
                    <Flame size={12} /> PRIORITY
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <StatusBadge status={order.status} />
                    <p className="mt-2 font-mono text-[13px] tabular-nums text-gray-700">{getDisplayOrderNumber(order)}</p>
                    <p className="font-medium text-[var(--oppa-text)]">{order.customerName}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${order.channel === 'onsite' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    aria-label="Details"
                    title="Details"
                    className="rounded-lg border border-[var(--oppa-border)] bg-white p-2 text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                  >
                    <Eye size={16} />
                  </button>
                </div>
                
                {/* Status Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-2">
                  {activeTab === 'pending' ? (
                    <button onClick={() => updateOrderStatus(order.id, 'preparing', 'preparing')} className={chipPrimary + " w-full justify-center"}>
                      <ChefHat size={14} /> Start Preparing
                    </button>
                  ) : activeTab === 'preparing' ? (
                    <button onClick={() => updateOrderStatus(order.id, 'prepared', 'history')} className={chipSuccess + " w-full justify-center"}>
                      <CheckCircle size={14} /> Done Preparing
                    </button>
                  ) : (
                    <span className={chipDisabled + " w-full justify-center"}>
                      <CheckCircle size={14} /> {order.status === 'delivered' ? 'Delivered' : 'Ready'}
                    </span>
                  )}
                </div>
              </div>
              </React.Fragment>
            ))}
          </div>

          {/* Desktop View */}
          <div className="relative z-0 hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
            <table className="w-full min-w-[1080px] table-auto text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--oppa-border)] bg-[#eaf3eb] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                  <th className="w-[1%] whitespace-nowrap px-4 py-2.5">Order ID</th>
                  <th className="w-[180px] px-4 py-2.5">Customer</th>
                  <th className="hidden w-[190px] whitespace-nowrap px-4 py-2.5 xl:table-cell">Date Ordered</th>
                  <th className="w-[100px] px-4 py-2.5">Items</th>
                  <th className="w-[135px] whitespace-nowrap px-4 py-2.5">Status</th>
                  <th className="w-[190px] whitespace-nowrap px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order, index) => (
                  <React.Fragment key={order.id}>
                  {index === 0 && priorityOrdersCount > 0 && (
                    <tr className="bg-orange-50/60">
                      <td colSpan={6} className="border-b border-orange-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-800">Priority orders</td>
                    </tr>
                  )}
                  {index === priorityOrdersCount && priorityOrdersCount > 0 && priorityOrdersCount < sortedOrders.length && (
                    <tr className="bg-[var(--oppa-cream)]/80">
                      <td colSpan={6} className="border-b border-[var(--oppa-border)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">Other orders</td>
                    </tr>
                  )}
                  {index === 0 && priorityOrdersCount === 0 && (
                    <tr className="bg-[var(--oppa-cream)]/80">
                      <td colSpan={6} className="border-b border-[var(--oppa-border)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">Other orders</td>
                    </tr>
                  )}
                  <tr className={`border-b border-[var(--oppa-border)]/60 transition-colors duration-150 motion-reduce:transition-none last:border-0 hover:bg-emerald-50/70 ${order.deliveryType === 'priority' ? 'bg-gradient-to-r from-orange-50 to-white shadow-[inset_4px_0_0_0_#f97316] hover:from-orange-100' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 align-middle">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono text-[13px] tabular-nums text-gray-700">{getDisplayOrderNumber(order)}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-sans text-[10px] font-medium ${order.channel === 'onsite' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                        </span>
                        {order.deliveryType === 'priority' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-white"><Flame size={11} /> PRIORITY</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <p className="font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                    </td>
                    <td className="hidden px-4 py-2.5 align-middle text-gray-500 xl:table-cell">
                      <OrderDateTime date={order.created_at} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-middle">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}</span>
                    </td>
                    <td className="px-4 py-2.5 align-middle">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-2.5 align-middle">
                      <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--oppa-text)] transition hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
                      >
                        <Eye size={14} /> Details
                      </button>
                      
                      {activeTab === 'pending' && (
                        <button onClick={() => updateOrderStatus(order.id, 'preparing', 'preparing')} className={chipPrimary}>
                          <ChefHat size={14} /> Start
                        </button>
                      )}
                      {activeTab === 'preparing' && (
                        <button onClick={() => updateOrderStatus(order.id, 'prepared', 'history')} className={chipSuccess}>
                          <CheckCircle size={14} /> Done
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">Order Details</h2>
                <p className="text-sm text-gray-500 font-mono">{getDisplayOrderNumber(selectedOrder)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-full p-2 hover:bg-gray-100 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date Ordered</p>
                  <p className="font-medium text-sm">{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-2">Items to Prepare</p>
                <ul className="space-y-2 bg-gray-50 p-4 rounded-xl">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between border-b last:border-0 pb-2 last:pb-0">
                      <span className="font-medium">
                        <span className="text-[var(--oppa-green)] mr-1">{item.quantity}x</span>
                        {item.name || item.product_name || item.title || 'Item'} 
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedOrder.scheduleDisplay && (
                 <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                   <Clock size={16} />
                   <span>Scheduled: {selectedOrder.scheduleDisplay}</span>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </KitchenLayout>
  );
};

export default KitchenDashboardPage;