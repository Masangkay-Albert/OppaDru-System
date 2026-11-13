import React, { useEffect, useState } from 'react';
import { ValidatedForm } from '../../../components/ui/FormValidation';

const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';

type Pricing = {
  delivery_base_fee: number;
  delivery_base_distance_km: number;
  delivery_per_km_rate: number;
  delivery_free_subtotal: number;
  delivery_max_fee: number;
  service_fee_rate: number;
  service_fee_min: number;
  service_fee_max: number;
};

const defaultPricing: Pricing = {
  delivery_base_fee: 49,
  delivery_base_distance_km: 3,
  delivery_per_km_rate: 10,
  delivery_free_subtotal: 999,
  delivery_max_fee: 150,
  service_fee_rate: 0.03,
  service_fee_min: 15,
  service_fee_max: 80,
};

const AdminPricingSettingsPage: React.FC = () => {
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/settings/pricing`)
      .then(response => response.json())
      .then(data => { if (data.settings) setPricing((previous) => ({ ...previous, ...data.settings })); })
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
      <ValidatedForm onSubmit={save} className="bg-white rounded-xl shadow p-6 space-y-4">
        {Object.keys(defaultPricing).map(key => (
          <label key={key} className="block text-sm font-medium text-gray-700">
            {key.replaceAll('_', ' ')}
            <input type="number" data-min="0" data-max={key === 'service_fee_rate' ? 1 : undefined} step={key === 'service_fee_rate' ? '0.01' : '0.01'} value={pricing[key as keyof Pricing]} onChange={event => setPricing({ ...pricing, [key]: Number(event.target.value) })} className="mt-1 w-full border rounded-lg p-2" />
          </label>
        ))}
        <button type="submit" className="bg-[#2d6a4f] text-white rounded-lg px-5 py-2 font-semibold">Save pricing</button>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </ValidatedForm>
    </div>
  );
};

export default AdminPricingSettingsPage;
