import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, CheckCircle, Clock, User, Eye, X, ArrowDownUp } from 'lucide-react';

import { STATUS_COLORS } from '../../utils/constants';
import KitchenLayout from './components/kitchenLayout'; 
import { API_URL } from '../../services/apiConfig'; 

const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipPrimary = `${chipBase} bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]/70 cursor-pointer`;
const chipSuccess = `${chipBase} bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer`;
const chipDisabled = `${chipBase} bg-gray-100 text-gray-500 cursor-default`;

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
  const sortedOrders = [...orders].sort((a, b) => {
    // Fallback to 0 if created_at is missing so the code doesn't crash
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  return (
    <KitchenLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--oppa-green)] mb-1">
            <User size={16} />
            <span>Logged in as {staffName}</span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">
            Kitchen Dashboard
          </h1>
        </div>
      </div>

      {/* Tabs and Sort Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['pending', 'preparing', 'history'] as TabView[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition capitalize ${
                activeTab === tab ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
              }`}
            >
              {tab === 'pending' ? 'New Orders' : tab === 'preparing' ? 'Currently Preparing' : 'History'}
            </button>
          ))}
        </div>

        {/* Sort Dropdown (Always visible now) */}
        <div className="flex w-max items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <ArrowDownUp size={16} className="text-[var(--oppa-green)]" />
          <span className="font-medium">Sort by:</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="cursor-pointer bg-transparent font-medium text-[var(--oppa-text)] outline-none"
          >
            <option value="desc">Latest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading orders...</div>
      ) : sortedOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          {activeTab === 'pending' ? 'No new orders to prepare.' 
           : activeTab === 'preparing' ? 'You are not preparing any orders right now.' 
           : 'No completed orders yet.'}
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="space-y-3 md:hidden">
            {sortedOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm relative overflow-hidden">
                {order.deliveryType === 'priority' && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                    Priority
                  </div>
                )}
                <div className="flex justify-between items-start mt-2">
                  <div>
                    <p className="font-medium text-[var(--oppa-text)]">{order.customerName}</p>
                    <p className="text-xs text-[var(--oppa-text-muted)]">{getDisplayOrderNumber(order)}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${order.channel === 'onsite' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="p-1.5 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Eye size={16} />
                  </button>
                </div>
                
                {/* Status Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
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
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date Ordered</th>
                  <th className="px-5 py-3 min-w-[200px]">Items</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                    <td className="px-5 py-3 font-mono text-xs align-middle">
                      {getDisplayOrderNumber(order)}
                      <span className={`mt-1 block w-fit rounded-full px-2 py-0.5 font-sans text-[10px] font-medium ${order.channel === 'onsite' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {order.channel === 'onsite' ? 'Onsite' : 'Online'}
                      </span>
                      {order.deliveryType === 'priority' && (
                        <span className="block mt-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded w-max uppercase">Priority</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium align-middle">{order.customerName || 'Customer'}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap align-middle">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <span className="text-gray-500">{order.items?.length || 0} items</span>
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 flex justify-end gap-2 align-middle">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 text-xs font-medium"
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
                    </td>
                  </tr>
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