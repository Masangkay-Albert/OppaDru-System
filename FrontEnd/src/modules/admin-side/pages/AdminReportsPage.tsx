// src/modules/admin-side/pages/AdminReportsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, type AdminOrder } from '../../../services/adminOrderService';
import { formatCurrency } from '../../../utils/formatters';

type ReportRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

const isWithinRange = (dateStr: string, range: ReportRange): boolean => {
  const date = new Date(dateStr);
  const now = new Date();
  switch (range) {
    case 'daily':
      return date.toDateString() === now.toDateString();
    case 'weekly': {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo && date <= now;
    }
    case 'monthly':
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    case 'yearly':
      return date.getFullYear() === now.getFullYear();
    default:
      return true;
  }
};

const AdminReportsPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [range, setRange] = useState<ReportRange>('daily');

  useEffect(() => {
    setOrders(getAllOrders());
  }, []);

  const filtered = useMemo(() => orders.filter((o) => isWithinRange(o.timestamp, range)), [orders, range]);

  const totalSales = filtered.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = filtered.length;
  const onlineCount = filtered.filter((o) => o.channel === 'online').length;
  const onsiteCount = filtered.filter((o) => o.channel === 'onsite').length;

  const itemsSold = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((o) => {
      o.items.forEach((item) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const handleExportCSV = () => {
    const rows = [
      ['Order ID', 'Customer', 'Channel', 'Total', 'Status', 'Date'],
      ...filtered.map((o) => [
        o.id,
        o.customerName || 'Customer',
        o.channel,
        o.total.toString(),
        o.status,
        new Date(o.timestamp).toLocaleString(),
      ]),
    ];
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Sales Report</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Review sales performance by period.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="bg-oppa-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        {(['daily', 'weekly', 'monthly', 'yearly'] as ReportRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
              range === r
                ? 'bg-oppa-gradient text-white shadow-sm'
                : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]/70'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-2xl font-bold text-[var(--oppa-text)]">{formatCurrency(totalSales)}</p>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Total Sales</p>
        </div>
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-2xl font-bold text-[var(--oppa-text)]">{totalOrders}</p>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Total Orders</p>
        </div>
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-2xl font-bold text-[var(--oppa-text)]">{onlineCount}</p>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Online Orders</p>
        </div>
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-2xl font-bold text-[var(--oppa-text)]">{onsiteCount}</p>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Onsite Orders</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--oppa-border)] px-5 py-4">
          <h2 className="font-serif font-semibold text-[var(--oppa-text)]">Items Sold</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Item Name</th>
                <th className="px-5 py-3">Quantity Sold</th>
              </tr>
            </thead>
            <tbody>
              {itemsSold.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-[var(--oppa-text-muted)]">
                    No sales recorded for this period.
                  </td>
                </tr>
              )}
              {itemsSold.map(([name, qty]) => (
                <tr key={name} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{name}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReportsPage;
