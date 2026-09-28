import React, { useEffect, useState } from "react";
import { PlusIcon, XIcon, PhoneIcon, MailIcon, Power, Trash2, CheckCircle, Clock3, Truck, Eye, MapPin } from "lucide-react";
import AdminLayout from '../components/AdminLayout';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';

export interface DeliveryPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  isActive: boolean;
}

interface DeliveryOrder {
  id: string;
  order_number?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  delivery_address?: string;
  total?: number;
  status?: string;
  delivery_proof_image?: string | null;
  delivery_proof_image_url?: string | null;
  delivery_proof_uploaded_at?: string | null;
  delivery_confirmed_at?: string | null;
  created_at?: string;
  driver_id?: string | null;
}

const isOnsiteOrder = (order: any): boolean => {
  if (order.channel === 'onsite') return true;
  if (order.delivery_type === 'onsite') return true;
  if (order.delivery_calculation_method === 'onsite') return true;
  const address = String(order.delivery_address || order.address || '').trim().toLowerCase();
  if (address.startsWith('onsite') || address.includes('walk-in') || address.includes('dine in') || address.includes('takeout')) return true;
  const email = String(order.email || '').trim().toLowerCase();
  if (email.startsWith('cashier') || email.startsWith('onsite')) return true;
  return false;
};

const getOrderTimestamp = (order: DeliveryOrder): number => {
  const dateStr = order.created_at || (order as any).timestamp;
  if (dateStr) {
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) return time;
  }
  const match = order.order_number?.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const time = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
};

export default function AdminDelivery() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [orderSort, setOrderSort] = useState<'latest' | 'oldest'>('latest');
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", vehicleType: "" });
  const [selectedProof, setSelectedProof] = useState<DeliveryOrder | null>(null);

  const sortedOrders = [...deliveryOrders].sort((a, b) => {
    const timeA = getOrderTimestamp(a);
    const timeB = getOrderTimestamp(b);
    return orderSort === 'latest' ? timeB - timeA : timeA - timeB;
  });

  const refresh = async () => {
    try {
      const res = await fetch(`${API_URL}/drivers`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch drivers:", error);
    }
  };

  const refreshDeliveryOrders = async () => {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/orders`);
      if (!res.ok) {
        throw new Error('Failed to load delivery orders');
      }
      const data = await res.json();
      const orders = Array.isArray(data) ? data : [];
      setDeliveryOrders(
        orders.filter(
          (order: any) =>
            ['prepared', 'ready', 'on_the_way', 'arrived', 'delivered'].includes(String(order.status || '').trim()) &&
            !isOnsiteOrder(order)
        )
      );
    } catch (error) {
      console.error('Failed to fetch delivery orders:', error);
      setDeliveryOrders([]);
    }
  };

  useEffect(() => {
    refresh();
    refreshDeliveryOrders();
  }, []);

  // ADD Driver
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure phone is exactly 11 digits
    if (form.phone.length !== 11) {
      alert("Phone number must be exactly 11 digits.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ ...form, isActive: true }), // Default to active
      });

      if (res.ok) {
        setForm({ name: "", email: "", password: "", phone: "", vehicleType: "" });
        setShowForm(false);
        refresh();
      } else {
        const errorData = await res.json();
        alert('Error: ' + (errorData.message || 'Failed to add partner'));
      }
    } catch (error) {
      console.error("Add driver error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // TOGGLE Driver Status
  const handleToggle = async (partner: DeliveryPartner) => {
    try {
      const res = await fetch(`${API_URL}/drivers/${partner.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ isActive: !partner.isActive }),
      });

      if (res.ok) {
        refresh();
      }
    } catch (error) {
      console.error("Toggle error:", error);
    }
  };

  // DELETE Driver
  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDeletePartner = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`${API_URL}/drivers/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) await refresh();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const statusLabel = (status?: string) => {
    switch (status) {
      case 'prepared':
      case 'ready':
        return 'Ready for Delivery';
      case 'on_the_way':
        return 'On the Way';
      case 'delivered':
        return 'Delivered';
      default:
        return status ? status.replace('_', ' ').toUpperCase() : 'Unknown';
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)]">Delivery Partners</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage your delivery fleet and riders.</p>
          </div>
          <button 
            onClick={() => setShowForm(true)} 
            className="flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)]"
          >
            <PlusIcon className="size-4" /> Add Partner
          </button>
        </div>

        {deleteTarget && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-2xl">
              <p className="text-base font-semibold text-[var(--oppa-text)]">Delete "{deleteTarget.name}"?</p>
              <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">This action will permanently remove this delivery partner.</p>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-full border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePartner}
                  className="rounded-full bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[var(--oppa-text)]">Delivery Orders</h2>
              <p className="text-sm text-[var(--oppa-text-muted)]">Monitor active delivery progress and final delivery status.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--oppa-text-muted)]">Sort:</span>
              <div className="inline-flex rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/30 p-1">
                <button
                  type="button"
                  onClick={() => setOrderSort('latest')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    orderSort === 'latest'
                      ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                      : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'
                  }`}
                >
                  Latest
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSort('oldest')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    orderSort === 'oldest'
                      ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                      : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'
                  }`}
                >
                  Oldest
                </button>
              </div>
            </div>
          </div>

          {sortedOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)]/40 p-6 text-center text-sm text-[var(--oppa-text-muted)]">
              No delivery orders are currently active.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--oppa-text-muted)]">
                        <Truck className="h-3.5 w-3.5" /> Order {order.order_number || order.id.slice(-6)}
                      </div>
                      <p className="mt-1 text-lg font-semibold text-[var(--oppa-text)]">{order.customerName || order.email || 'Customer'}</p>
                      {order.created_at && (
                        <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Manila',
                          })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : order.status === 'on_the_way' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                        {order.status === 'on_the_way' ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        {statusLabel(order.status)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-2 text-sm text-[var(--oppa-text)]">
                      <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[var(--oppa-green)]" /><span>{order.delivery_address || 'Address unavailable'}</span></div>
                      {order.phone && <div className="text-[var(--oppa-text-muted)]">Contact: {order.phone}</div>}
                      <div className="font-medium text-[var(--oppa-text-muted)]">Total: ₱{Number(order.total || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="text-xs uppercase tracking-[0.08em] text-[var(--oppa-text-muted)]">Proof status</div>
                      {order.delivery_proof_image || order.delivery_proof_image_url ? (
                        <div className="flex flex-col items-start gap-1 md:items-end">
                          <button onClick={() => setSelectedProof(order)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90">
                            <Eye className="h-4 w-4" /> View Details
                          </button>
                          {order.delivery_confirmed_at && (
                            <span className="text-[11px] font-medium text-emerald-700">✓ Delivered</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                          <Truck className="h-4 w-4" /> Active delivery
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProof && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-[var(--oppa-text)]">Delivery Details</h3>
                  <p className="text-sm text-[var(--oppa-text-muted)]">{selectedProof.order_number || selectedProof.id}</p>
                </div>
                <button onClick={() => setSelectedProof(null)} className="rounded-full p-2 hover:bg-[var(--oppa-cream)]">
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/30 p-3 text-sm text-[var(--oppa-text)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Customer</div>
                      <div>{selectedProof.customerName || selectedProof.email || 'Customer'}</div>
                    </div>
                    {selectedProof.delivery_confirmed_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        <CheckCircle className="h-3.5 w-3.5" /> Delivered
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[var(--oppa-text-muted)]">{selectedProof.delivery_address || 'Address unavailable'}</div>
                </div>

                {selectedProof.delivery_confirmed_at && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Delivery completed</p>
                      <p className="text-xs text-green-700">The driver marked this order as Delivered.</p>
                    </div>
                  </div>
                )}

                {!selectedProof.delivery_confirmed_at && (
                  <div className="rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)]/20 p-6 text-center text-sm text-[var(--oppa-text-muted)]">
                    Delivery status is currently in progress. The customer and admin will see the final Delivered state once the driver completes it.
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setSelectedProof(null)} className="rounded-full border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--oppa-text)]">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {partners.length === 0 && (
          <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
            No delivery partners registered yet.
          </div>
        )}

        {/* Mobile View: Cards */}
        {partners.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {partners.map((p) => (
              <div key={p.id} className="space-y-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[var(--oppa-green)] font-semibold text-white">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--oppa-green)]">{p.name}</p>
                      <p className="text-xs capitalize text-[var(--oppa-text-muted)]">{p.vehicleType}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-[var(--oppa-text-muted)] border-t border-[var(--oppa-border)] pt-3">
                  <p className="flex items-center gap-2"><MailIcon className="h-3.5 w-3.5" /> {p.email}</p>
                  <p className="flex items-center gap-2"><PhoneIcon className="h-3.5 w-3.5" /> {p.phone}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleToggle(p)} className="flex-1 rounded-lg bg-[var(--oppa-green)]/10 py-2 text-xs font-medium text-[var(--oppa-green)] transition hover:bg-[var(--oppa-green)]/20">
                    {p.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="rounded-lg bg-red-50 px-3 py-2 text-red-500 transition hover:bg-red-100">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop View: Data Table */}
        {partners.length > 0 && (
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--oppa-border)] bg-gray-50 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                  <th className="px-5 py-4">Partner Info</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--oppa-border)]/60 hover:bg-gray-50/50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[var(--oppa-green)]/10 font-semibold text-[var(--oppa-green)]">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs capitalize text-gray-500">{p.vehicleType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 space-y-1">
                      <div className="flex items-center gap-2"><MailIcon className="h-3.5 w-3.5" /> {p.email}</div>
                      <div className="flex items-center gap-2"><PhoneIcon className="h-3.5 w-3.5" /> {p.phone}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleToggle(p)} 
                          title={p.isActive ? "Deactivate" : "Activate"}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${p.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          <Power className="size-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.name)} 
                          title="Delete"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-8 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Onboard Partner</h2>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-1 focus:ring-[var(--oppa-green)]" />
                <input type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-1 focus:ring-[var(--oppa-green)]" />
                <input type="password" placeholder="Password" minLength={6} required value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-1 focus:ring-[var(--oppa-green)]" />
                <select required value={form.vehicleType} onChange={(e) => setForm({...form, vehicleType: e.target.value})} className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-1 focus:ring-[var(--oppa-green)]">
                  <option value="" disabled>Select Vehicle Type</option>
                  <option value="bike">Bike</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
                
                {/* 11-Digit Phone Input */}
                <input 
                  type="tel" 
                  placeholder="Phone Number (11 digits)" 
                  maxLength={11}
                  required 
                  value={form.phone} 
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/\D/g, '');
                    setForm({...form, phone: onlyNumbers});
                  }} 
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[var(--oppa-green)] focus:ring-1 focus:ring-[var(--oppa-green)]" 
                />

                <button type="submit" disabled={isLoading} className="mt-2 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Create Partner'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


