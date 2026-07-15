// src/modules/admin-side/pages/AdminDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Users, Package, AlertTriangle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import StatCard from '../components/StatCard';
import { getAllOrders, type AdminOrder } from '../../../services/adminOrderService';
import { getAllAccounts } from '../../../services/adminAuthService';
import { getAllProducts } from '../../../services/adminProductService';
import { formatCurrency } from '../../../utils/formatters';
import { STATUS_COLORS } from '../../../utils/constants';

const AdminDashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [outOfStock, setOutOfStock] = useState(0);

  useEffect(() => {
    const allOrders = getAllOrders();
    setOrders(allOrders);
    setTotalUsers(getAllAccounts().length);
    const products = getAllProducts();
    setTotalProducts(products.length);
    setOutOfStock(products.filter((p) => !p.isAvailable).length);
  }, []);

  const recentOrders = orders.slice(0, 8);

  return (
    <AdminLayout>
      <h1 className="mb-1 mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Dashboard</h1>
      <p className="mb-6 text-sm text-[var(--oppa-text-muted)]">Welcome back, here's what's happening today.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingBag} />
        <StatCard label="Total Users" value={totalUsers} icon={Users} />
        <StatCard label="Total Products" value={totalProducts} icon={Package} />
        <StatCard label="Out of Stock" value={outOfStock} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4">
          <h2 className="font-serif font-semibold text-[var(--oppa-text)]">Recent Orders</h2>
          <Link
            to="/admin/orders"
            className="text-sm font-medium text-[var(--oppa-green-dark)] hover:underline"
          >
            View All →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--oppa-text-muted)]">
                    No orders yet.
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]"
                >
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">#{order.id.slice(-6)}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                  </td>
                  <td className="px-5 py-3 capitalize text-[var(--oppa-text-muted)]">{order.channel}</td>
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}
                    >
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">
                    {new Date(order.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
