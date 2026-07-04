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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingBag} />
        <StatCard label="Total Users" value={totalUsers} icon={Users} />
        <StatCard label="Total Products" value={totalProducts} icon={Package} />
        <StatCard label="Out of Stock" value={outOfStock} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recent Orders</h2>
          <Link to="/admin/orders" className="text-orange-500 text-sm font-medium hover:underline">
            View All →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
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
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No orders yet.
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-500">#{order.id.slice(-6)}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{order.customerName || 'Customer'}</p>
                  </td>
                  <td className="px-5 py-3 capitalize text-gray-600">{order.channel}</td>
                  <td className="px-5 py-3 font-medium">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}
                    >
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
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
