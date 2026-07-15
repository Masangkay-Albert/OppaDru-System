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

// Shared action-button styles so every list/table here uses one consistent toolbar look.
const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipSuccess = `${chipBase} bg-green-50 text-green-600 hover:bg-green-100`;
const iconDangerBtn = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700';

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Track online and onsite orders in real time.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-oppa-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <PlusCircle size={16} /> Add Onsite Order
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddOnsite}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <input
            placeholder="Customer name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <input
            placeholder="Item name"
            required
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <input
            type="number"
            min={1}
            placeholder="Qty"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <input
            type="number"
            min={0}
            required
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <button
            type="submit"
            className="bg-oppa-gradient rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:col-span-2 lg:col-span-1"
          >
            Save Order
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'online', 'onsite'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f
                ? 'bg-oppa-gradient text-white shadow-sm'
                : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          No orders found.
        </div>
      )}

      {/* Mobile / tablet: tidy stacked cards */}
      {filteredOrders.length > 0 && (
        <div className="space-y-3 md:hidden">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                  <p className="text-xs text-[var(--oppa-text-muted)]">#{order.id.slice(-6)}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
                <span className="capitalize">{order.channel}</span>
                <span>•</span>
                <span className="font-semibold text-[var(--oppa-text)]">{formatCurrency(order.total)}</span>
                <span>•</span>
                <span>{new Date(order.timestamp).toLocaleDateString()}</span>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                {!order.served && (
                  <button onClick={() => handleServe(order)} className={chipSuccess}>
                    <CheckCircle size={13} /> Mark Served
                  </button>
                )}
                <button onClick={() => handleRemove(order)} className={iconDangerBtn} title="Remove order">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: full data table */}
      {filteredOrders.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Channel</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">#{order.id.slice(-6)}</td>
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</td>
                  <td className="px-5 py-3 capitalize text-[var(--oppa-text-muted)]">{order.channel}</td>
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {!order.served && (
                        <button onClick={() => handleServe(order)} className={chipSuccess}>
                          <CheckCircle size={13} /> Mark Served
                        </button>
                      )}
                      <button onClick={() => handleRemove(order)} className={iconDangerBtn} title="Remove order">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminOrdersPage;
