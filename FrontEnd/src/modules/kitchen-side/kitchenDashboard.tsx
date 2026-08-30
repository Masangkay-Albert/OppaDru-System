import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, CheckCircle, Clock, Utensils, User } from 'lucide-react';

import { 
  getPendingOrders, 
  getPreparingOrders,
  getKitchenHistory,
  startPreparing, 
  finishPreparing,
  type KitchenOrder
} from '../../services/kitchenOrderService';
import { STATUS_COLORS } from '../../utils/constants';
import KitchenLayout from './components/kitchenLayout'; 

const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipPrimary = `${chipBase} bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]/70`;
const chipSuccess = `${chipBase} bg-green-50 text-green-600 hover:bg-green-100`;
const chipDisabled = `${chipBase} bg-gray-100 text-gray-500 cursor-default`;

type TabView = 'pending' | 'preparing' | 'history';

const KitchenDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('pending');
  const [staffName, setStaffName] = useState<string>("Kitchen Staff");

  // Fetch employee details AND act as a security bouncer
  useEffect(() => {
    const authData = localStorage.getItem("employee_auth");
    const token = localStorage.getItem("employee_token");

    // THE BOUNCER: If there is no token or data, kick them to the staff login page
    // Adjust '/staff/login' to whatever route you assigned to your StaffLoginPage
    if (!token || !authData) {
      navigate('/staff/login', { replace: true });
      return; 
    }

    // If they ARE logged in, get their name for the welcome message
    try {
      const employee = JSON.parse(authData);
      // Your Employee model uses 'fullName'
      if (employee && employee.fullName) {
        setStaffName(employee.fullName);
      } else if (employee && employee.name) {
        setStaffName(employee.name); // Fallback just in case
      }
    } catch (error) {
      console.error("Failed to parse employee data", error);
      navigate('/staff/login', { replace: true }); 
    }
  }, [navigate]);

  const refresh = () => {
    if (activeTab === 'pending') setOrders(getPendingOrders());
    else if (activeTab === 'preparing') setOrders(getPreparingOrders());
    else setOrders(getKitchenHistory());
  };

  useEffect(() => {
    refresh();
  }, [activeTab]);

  const handleStartPreparing = (order: KitchenOrder) => {
    startPreparing(order.id);
    setActiveTab('preparing');
  };

  const handleFinishPreparing = (order: KitchenOrder) => {
    finishPreparing(order.id);
    setActiveTab('history');
  };

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
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">
            Manage incoming orders and food preparation.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'pending' ? 'bg-oppa-gradient text-white shadow-sm' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          New Orders
        </button>
        <button
          onClick={() => setActiveTab('preparing')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'preparing' ? 'bg-oppa-gradient text-white shadow-sm' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          Currently Preparing
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'history' ? 'bg-oppa-gradient text-white shadow-sm' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          History
        </button>
      </div>

      {orders.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          {activeTab === 'pending' 
            ? 'No new orders to prepare.' 
            : activeTab === 'preparing' 
            ? 'You are not preparing any orders right now.' 
            : 'No completed orders yet.'}
        </div>
      )}

      {/* Mobile / tablet: tidy stacked cards */}
      {orders.length > 0 && (
        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm relative overflow-hidden">
              {order.deliveryType === 'priority' && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                  Priority
                </div>
              )}
              
              <div className="flex items-start justify-between gap-2 mt-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                  <p className="text-xs text-[var(--oppa-text-muted)]">#{order.id.slice(-6)}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-3 flex-1 bg-[var(--oppa-cream)] rounded-xl p-3">
                <p className="text-xs font-bold text-[var(--oppa-green)] mb-2 flex items-center gap-1">
                  <Utensils size={14} /> Items to Prepare:
                </p>
                <ul className="space-y-1.5">
                  {order.items.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm font-medium text-[var(--oppa-text)] flex justify-between border-b border-[var(--oppa-border)]/50 pb-1 last:border-0 last:pb-0">
                      <span>{item.quantity}x {item.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 font-medium">
                  <Clock size={14} className="flex-shrink-0" />
                  <span>Scheduled: {order.scheduleDisplay}</span>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                {activeTab === 'pending' ? (
                  <button onClick={() => handleStartPreparing(order)} className={chipPrimary + " w-full justify-center"}>
                    <ChefHat size={14} /> Start Preparing
                  </button>
                ) : activeTab === 'preparing' ? (
                  <button onClick={() => handleFinishPreparing(order)} className={chipSuccess + " w-full justify-center"}>
                    <CheckCircle size={14} /> Done Preparing
                  </button>
                ) : (
                  <span className={chipDisabled + " w-full justify-center"}>
                    <CheckCircle size={14} /> Ready / Dispatched
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: full data table */}
      {orders.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 min-w-[200px]">Items to Prepare</th>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 align-top">
                    <p className="text-[var(--oppa-text-muted)] font-mono text-xs">#{order.id.slice(-6)}</p>
                    {order.deliveryType === 'priority' && (
                      <span className="inline-block mt-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Priority</span>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <p className="font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <ul className="list-disc list-inside text-[var(--oppa-text)] text-xs space-y-1">
                      {order.items.map((item: any, idx: number) => (
                        <li key={idx} className="font-medium">
                          <span className="text-[var(--oppa-green)]">{item.quantity}x</span> {item.name}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-5 py-3 align-top">
                    {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' ? (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Clock size={12} /> {order.scheduleDisplay}
                      </p>
                    ) : (
                      <span className="text-xs text-[var(--oppa-text-muted)]">ASAP</span>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-top">
                    {activeTab === 'pending' ? (
                      <button onClick={() => handleStartPreparing(order)} className={chipPrimary}>
                        <ChefHat size={14} /> Start
                      </button>
                    ) : activeTab === 'preparing' ? (
                      <button onClick={() => handleFinishPreparing(order)} className={chipSuccess}>
                        <CheckCircle size={14} /> Done
                      </button>
                    ) : (
                      <span className={chipDisabled}>
                        <CheckCircle size={14} /> Ready
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </KitchenLayout>
  );
};

export default KitchenDashboardPage;