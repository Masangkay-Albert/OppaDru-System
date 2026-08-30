import React, { useEffect, useState } from "react";
import { PlusIcon, XIcon, PhoneIcon, MailIcon, Power, Trash2 } from "lucide-react";
import AdminLayout from '../components/AdminLayout';

// Interface matching your Laravel Database
export interface DeliveryPartner {
  id: string; 
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  isActive: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export default function AdminDelivery() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", vehicleType: "" });

  // FETCH Drivers from Laravel (Supabase)
  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/drivers`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(data);
      }
    } catch (error) {
      console.error("Failed to fetch drivers:", error);
    }
  };

  useEffect(() => {
    refresh();
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
      const res = await fetch(`${API_BASE_URL}/drivers`, {
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
      const res = await fetch(`${API_BASE_URL}/drivers/${partner.id}`, {
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
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this delivery partner?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/drivers/${id}`, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) refresh();
      } catch (error) {
        console.error("Delete error:", error);
      }
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
                  <button onClick={() => handleDelete(p.id)} className="rounded-lg bg-red-50 px-3 py-2 text-red-500 transition hover:bg-red-100">
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
                          onClick={() => handleDelete(p.id)} 
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


