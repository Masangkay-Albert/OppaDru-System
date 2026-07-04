// src/modules/admin-side/pages/AdminOrdersPage.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, Trash2, PlusCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import {
  getAllOrders,
  addOnsiteOrder,
  markOrderServed,
  removeOrder,
  type AdminOrder,
  type OrderChannel,
} from '../../../services/adminOrderService';
import { formatCurrency } from '../../../utils/formatters';
import { STATUS_COLORS } from '../../../utils/constants';

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<'all' | OrderChannel>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: '', itemName: '', quantity: 1, price: '', paymentMethod: 'Cash' });

  const refresh = () => setOrders(getAllOrders());

  useEffect(() => {
    refresh();
  }, []);

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.channel === filter);

  const handleServe = (order: AdminOrder) => {
    markOrderServed(order.id, order.channel);
    refresh();
  };

  const handleRemove = (order: AdminOrder) => {
    removeOrder(order.id, order.channel);
    refresh();
  };

  const handleAddOnsite = (e: React.FormEvent) => {
    e.preventDefault();
    addOnsiteOrder({
      customerName: form.customerName || 'Walk-in Customer',
      items: [{ name: form.itemName, quantity: Number(form.quantity) || 1, price: Number(form.price) || 0 }],
      paymentMethod: form.paymentMethod,
    });
    setForm({ customerName: '', itemName: '', quantity: 1, price: '', paymentMethod: 'Cash' });
    setShowForm(false);
    refresh();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-lime-700 hover:bg-lime-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <PlusCircle size={16} /> Add Onsite Order
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddOnsite}
          className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <input
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            placeholder="Item name"
            required
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            placeholder="Qty"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            required
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2">
            Save Order
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'online', 'onsite'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-5 py-3">Order ID</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Channel</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                  No orders found.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 text-gray-500">#{order.id.slice(-6)}</td>
                <td className="px-5 py-3 font-medium text-gray-800">{order.customerName || 'Customer'}</td>
                <td className="px-5 py-3 capitalize text-gray-600">{order.channel}</td>
                <td className="px-5 py-3 font-medium">{formatCurrency(order.total)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {!order.served && (
                      <button
                        onClick={() => handleServe(order)}
                        className="flex items-center gap-1 text-green-600 hover:underline text-xs font-medium"
                      >
                        <CheckCircle size={14} /> Mark Served
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(order)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminOrdersPage;
