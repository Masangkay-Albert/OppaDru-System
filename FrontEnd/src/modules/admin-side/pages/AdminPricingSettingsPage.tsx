import React, { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system.onrender.com/api';

type Pricing = { service_fee: number; delivery_fee_standard: number; delivery_fee_priority: number };

const AdminPricingSettingsPage: React.FC = () => {
  const [pricing, setPricing] = useState<Pricing>({ service_fee: 0, delivery_fee_standard: 0, delivery_fee_priority: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/settings/pricing`)
      .then(response => response.json())
      .then(data => { if (data.settings) setPricing(data.settings); })
      .catch(() => setMessage('Unable to load pricing settings.'));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch(`${API_URL}/settings/pricing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` },
      body: JSON.stringify(pricing),
    });
    const data = await response.json();
    setMessage(response.ok ? 'Pricing settings saved.' : data.message || 'Unable to save pricing settings.');
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Pricing settings</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow p-6 space-y-4">
        {(['service_fee', 'delivery_fee_standard', 'delivery_fee_priority'] as const).map(key => (
          <label key={key} className="block text-sm font-medium text-gray-700">
            {key === 'service_fee' ? 'Service fee' : key === 'delivery_fee_standard' ? 'Standard delivery fee' : 'Priority delivery fee'}
            <input type="number" min="0" step="0.01" value={pricing[key]} onChange={event => setPricing({ ...pricing, [key]: Number(event.target.value) })} className="mt-1 w-full border rounded-lg p-2" />
          </label>
        ))}
        <button type="submit" className="bg-[#2d6a4f] text-white rounded-lg px-5 py-2 font-semibold">Save pricing</button>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </form>
    </div>
  );
};

export default AdminPricingSettingsPage;
