// src/modules/driver-side/pages/DriverDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Truck, MapPin, CheckCircle, Phone, Clock, CreditCard } from 'lucide-react';
import DriverLayout from '../components/DriverLayout';
import { 
  getAvailableDriverOrders, 
  getActiveDeliveries,
  getDeliveredOrders, // Added this import
  acceptOrder, 
  completeDelivery,
  type DriverOrder
} from '../../../services/driverOrderService';
import { formatCurrency } from '../../../utils/formatters';
import { STATUS_COLORS } from '../../../utils/constants';

// Shared action-button styles
const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipPrimary = `${chipBase} bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]/70`;
const chipSuccess = `${chipBase} bg-green-50 text-green-600 hover:bg-green-100`;
const chipDisabled = `${chipBase} bg-gray-100 text-gray-500 cursor-default`; // Added for history

type TabView = 'available' | 'active' | 'history'; // Added 'history'

const formatPaymentMethod = (method?: string) => {
  if (!method) return 'Unknown';
  if (method === 'cash_on_delivery') return 'Cash on Delivery';
  if (method === 'gcash') return 'GCash';
  if (method === 'credit_card') return 'Credit Card';
  return method;
};

const DriverDashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('available');

  const refresh = () => {
    if (activeTab === 'available') {
      setOrders(getAvailableDriverOrders());
    } else if (activeTab === 'active') {
      setOrders(getActiveDeliveries());
    } else {
      setOrders(getDeliveredOrders()); // Fetch history
    }
  };

  useEffect(() => {
    refresh();
  }, [activeTab]);

  const handleAcceptOrder = (order: DriverOrder) => {
    acceptOrder(order.id);
    setActiveTab('active');
  };

  const handleCompleteDelivery = (order: DriverOrder) => {
    completeDelivery(order.id);
    setActiveTab('history'); // Move to history tab after completing
  };

  return (
    <DriverLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">
            Delivery Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">
            Manage available orders and track your active deliveries.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('available')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'available'
              ? 'bg-oppa-gradient text-white shadow-sm'
              : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          Available Orders
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'active'
              ? 'bg-oppa-gradient text-white shadow-sm'
              : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          My Active Deliveries
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === 'history'
              ? 'bg-oppa-gradient text-white shadow-sm'
              : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
          }`}
        >
          History
        </button>
      </div>

      {orders.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          {activeTab === 'available' 
            ? 'No delivery orders available right now.' 
            : activeTab === 'active' 
            ? 'You have no active deliveries.' 
            : 'You have not completed any deliveries yet.'}
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

              <div className="mt-3 space-y-1.5">
                <div className="flex items-start gap-2 text-xs text-[var(--oppa-text-muted)]">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#e76f51]" />
                  <span className="line-clamp-2">{order.deliveryAddress || order.address}</span>
                </div>

                {order.phone && (
                  <div className="flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
                    <Phone size={14} className="flex-shrink-0" />
                    <span>{order.phone}</span>
                  </div>
                )}

                {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                    <Clock size={14} className="flex-shrink-0" />
                    <span>Scheduled: {order.scheduleDisplay}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
                  <CreditCard size={14} className="flex-shrink-0" />
                  <span className={order.paymentMethod === 'cash_on_delivery' ? 'font-bold text-red-500' : ''}>
                    {formatPaymentMethod(order.paymentMethod)} • {formatCurrency(order.total)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                {activeTab === 'available' ? (
                  <button onClick={() => handleAcceptOrder(order)} className={chipPrimary}>
                    <Truck size={14} /> Accept Order
                  </button>
                ) : activeTab === 'active' ? (
                  <button onClick={() => handleCompleteDelivery(order)} className={chipSuccess}>
                    <CheckCircle size={14} /> Mark Delivered
                  </button>
                ) : (
                  <span className={chipDisabled}>
                    <CheckCircle size={14} /> Completed
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
                <th className="px-5 py-3">Order Details</th>
                <th className="px-5 py-3">Customer Info</th>
                <th className="px-5 py-3">Delivery Address</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3">
                    <p className="text-[var(--oppa-text-muted)] font-mono text-xs">#{order.id.slice(-6)}</p>
                    {order.deliveryType === 'priority' && (
                      <span className="inline-block mt-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Priority</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                    {order.phone && <p className="text-xs text-[var(--oppa-text-muted)]">{order.phone}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-[var(--oppa-text-muted)] max-w-xs truncate" title={order.deliveryAddress || order.address}>
                      {order.deliveryAddress || order.address}
                    </p>
                    {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' && (
                      <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                        <Clock size={12} /> {order.scheduleDisplay}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[var(--oppa-text)]">{formatCurrency(order.total)}</p>
                    <p className={`text-xs ${order.paymentMethod === 'cash_on_delivery' ? 'text-red-500 font-medium' : 'text-[var(--oppa-text-muted)]'}`}>
                      {formatPaymentMethod(order.paymentMethod)}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {activeTab === 'available' ? (
                      <button onClick={() => handleAcceptOrder(order)} className={chipPrimary}>
                        <Truck size={14} /> Accept
                      </button>
                    ) : activeTab === 'active' ? (
                      <button onClick={() => handleCompleteDelivery(order)} className={chipSuccess}>
                        <CheckCircle size={14} /> Delivered
                      </button>
                    ) : (
                      <span className={chipDisabled}>
                        <CheckCircle size={14} /> Done
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DriverLayout>
  );
};

export default DriverDashboardPage;