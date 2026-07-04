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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-lime-700 hover:bg-lime-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['daily', 'weekly', 'monthly', 'yearly'] as ReportRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
              range === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Sales</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          <p className="text-sm text-gray-500 mt-1">Total Orders</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{onlineCount}</p>
          <p className="text-sm text-gray-500 mt-1">Online Orders</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{onsiteCount}</p>
          <p className="text-sm text-gray-500 mt-1">Onsite Orders</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Items Sold</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-5 py-3">Item Name</th>
              <th className="px-5 py-3">Quantity Sold</th>
            </tr>
          </thead>
          <tbody>
            {itemsSold.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-gray-400">
                  No sales recorded for this period.
                </td>
              </tr>
            )}
            {itemsSold.map(([name, qty]) => (
              <tr key={name} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-800">{name}</td>
                <td className="px-5 py-3 text-gray-600">{qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminReportsPage;
