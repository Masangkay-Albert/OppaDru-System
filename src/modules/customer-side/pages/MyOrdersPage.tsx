// src/modules/customer-side/pages/MyOrdersPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPackage, FiClock, FiTruck, FiCheckCircle, FiChevronRight } from 'react-icons/fi';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import type { Order } from '../../../contexts/OrderContext';

const STATUS_DISPLAY: Record<string, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  [ORDER_STATUS.PENDING]: { label: 'Pending', icon: <FiClock size={13} />, badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  [ORDER_STATUS.PREPARING]: { label: 'Preparing', icon: <FiPackage size={13} />, badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
  [ORDER_STATUS.ON_WAY]: { label: 'On the way', icon: <FiTruck size={13} />, badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200' },
  [ORDER_STATUS.DELIVERED]: { label: 'Delivered', icon: <FiCheckCircle size={13} />, badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

const formatOrderDate = (isoString: string) =>
  new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { orders } = useOrder();

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const handleOrderClick = (order: Order) => {
    if (order.status !== ORDER_STATUS.DELIVERED) {
      navigate('/tracking', { state: { orderId: order.id } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center gap-2 text-gray-500 hover:text-[var(--oppa-green-dark)] transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-sm font-medium">Back to Menu</span>
          </button>
          <span className="text-gray-300 text-xl">|</span>
          <h1 className="text-xl font-bold text-[var(--oppa-green-dark)] font-serif">My Orders</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {sortedOrders.length === 0 ? (
            <div className="py-16 text-center">
              <FiPackage className="text-5xl text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">No orders yet</h2>
              <p className="text-gray-500 text-sm mb-5">You haven't placed any orders yet.</p>
              <button
                onClick={() => navigate('/customer')}
                className="px-6 py-2.5 bg-[var(--oppa-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm"
              >
                Browse Menu →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50/70 text-left">
                    <th className="py-3 pl-5 pr-3 text-xs font-semibold text-gray-400 uppercase">S/N</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Order ID</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Items</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Total</th>
                    <th className="py-3 px-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="py-3 pl-3 pr-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order, index) => {
                    const isActive = order.status !== ORDER_STATUS.DELIVERED;
                    const display = STATUS_DISPLAY[order.status] ?? STATUS_DISPLAY[ORDER_STATUS.PENDING];

                    return (
                      <tr
                        key={order.id}
                        onClick={isActive ? () => handleOrderClick(order) : undefined}
                        className={`border-b border-gray-100 last:border-0 align-top ${
                          isActive ? 'cursor-pointer hover:bg-[var(--oppa-green-soft)]/40' : ''
                        }`}
                      >
                        <td className="py-4 pl-5 pr-3 text-sm text-gray-400">{index + 1}</td>
                        <td className="py-4 px-3 text-sm font-semibold text-gray-700">{order.id}</td>
                        <td className="py-4 px-3 text-sm text-gray-800 min-w-[200px]">
                          {order.items.map((item) => (
                            <p key={item.cartItemId} className="leading-snug">
                              <span className="text-[var(--oppa-green-dark)] font-semibold">{item.quantity}x</span>{' '}
                              {item.name}
                            </p>
                          ))}
                        </td>
                        <td className="py-4 px-3 text-sm text-gray-500 whitespace-nowrap">{formatOrderDate(order.timestamp)}</td>
                        <td className="py-4 px-3 text-sm font-bold text-[var(--oppa-green-dark)] whitespace-nowrap">
                          ₱{order.total.toFixed(0)}
                        </td>
                        <td className="py-4 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${display.badgeClass}`}>
                            {display.icon}
                            {display.label}
                          </span>
                        </td>
                        <td className="py-4 pl-3 pr-5 text-right">
                          {isActive && <FiChevronRight className="inline text-gray-300" size={18} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyOrdersPage;