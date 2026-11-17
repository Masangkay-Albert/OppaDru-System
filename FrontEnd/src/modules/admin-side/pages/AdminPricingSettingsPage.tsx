import React, { useEffect, useState } from 'react';
import { ValidatedForm } from '../../../components/ui/FormValidation';
import { useStoreHours } from '../../../contexts/StoreHoursContext';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';

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

type SimulationSettings = {
  enabled: boolean;
  simulated_at: string | null;
  real_server_time: string;
};

type SimulationState = 'open' | 'last_order_passed' | 'closed';

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

const stateLabels: Record<SimulationState, string> = {
  open: 'Open',
  last_order_passed: 'Last order passed',
  closed: 'Closed',
};

const toDateTimeLocalValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const AdminPricingSettingsPage: React.FC = () => {
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  const [message, setMessage] = useState('');
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [simulatedAt, setSimulatedAt] = useState('');
  const [realServerTime, setRealServerTime] = useState('');
  const [simulationMessage, setSimulationMessage] = useState('');
  const [isSavingSimulation, setIsSavingSimulation] = useState(false);
  const [isLoadingSimulation, setIsLoadingSimulation] = useState(true);
  const { status: storeHours, refreshStatus } = useStoreHours();

  useEffect(() => {
    fetch(`${API_URL}/settings/pricing`)
      .then(response => response.json())
      .then(data => { if (data.settings) setPricing((previous) => ({ ...previous, ...data.settings })); })
      .catch(() => setMessage('Unable to load pricing settings.'));
  }, []);

  useEffect(() => {
    let active = true;
    fetchWithAdminAuth(`${API_URL}/admin/store-hours/simulation`)
      .then(async (response) => {
        const data = await response.json() as SimulationSettings & { message?: string };
        if (!response.ok) throw new Error(data.message || 'Unable to load ordering-hours simulation settings.');
        if (!active) return;
        setSimulationEnabled(data.enabled);
        setRealServerTime(data.real_server_time);
        setSimulatedAt(data.enabled && data.simulated_at ? data.simulated_at : data.real_server_time);
      })
      .catch((error: unknown) => {
        if (active) setSimulationMessage(error instanceof Error ? error.message : 'Unable to load ordering-hours simulation settings.');
      })
      .finally(() => {
        if (active) setIsLoadingSimulation(false);
      });

    return () => { active = false; };
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

  const persistSimulation = async (enabled: boolean, selectedTime: string) => {
    setIsSavingSimulation(true);
    setSimulationMessage('');
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/admin/store-hours/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ enabled, simulated_at: selectedTime || null }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || 'Unable to save ordering-hours simulation settings.');
      setSimulationMessage(data.message || 'Ordering-hours simulation settings saved.');
      await refreshStatus();
    } catch (error) {
      setSimulationMessage(error instanceof Error ? error.message : 'Unable to save ordering-hours simulation settings.');
    } finally {
      setIsSavingSimulation(false);
    }
  };

  const saveSimulation = async (event: React.FormEvent) => {
    event.preventDefault();
    await persistSimulation(simulationEnabled, simulatedAt);
  };

  const useLaptopTimeAndSave = async () => {
    const selectedTime = toDateTimeLocalValue(new Date());
    setSimulationEnabled(true);
    setSimulatedAt(selectedTime);
    await persistSimulation(true, selectedTime);
  };

  const setPresetTime = (time: string) => {
    const date = (simulatedAt || realServerTime).slice(0, 10);
    if (date) setSimulatedAt(`${date}T${time}`);
  };

  const effectiveTime = storeHours?.current_store_time
    ? new Date(storeHours.current_store_time).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : 'Loading current store time…';

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pricing settings</h1>

      <section aria-labelledby="ordering-hours-simulation-title" className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h2 id="ordering-hours-simulation-title" className="text-lg font-semibold text-gray-800">Ordering hours simulation</h2>
          <p className="mt-1 text-sm text-gray-500">Test Menu ordering hours with a server-saved clock. Changes apply to all visitors after saving.</p>
        </div>

        {isLoadingSimulation ? (
          <p role="status" className="text-sm text-gray-500">Loading simulation settings…</p>
        ) : (
          <form onSubmit={saveSimulation} className="space-y-4">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={simulationEnabled}
                onChange={(event) => setSimulationEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#2d6a4f] focus:ring-[#2d6a4f]"
              />
              Use simulated time
            </label>

            <div className="rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-600">
                After changing this computer's clock, use it as the simulated Asia/Manila time for all visitors.
              </p>
              <button
                type="button"
                onClick={() => void useLaptopTimeAndSave()}
                disabled={isSavingSimulation}
                className="mt-3 rounded-lg border border-[#2d6a4f] px-4 py-2 text-sm font-semibold text-[#2d6a4f] hover:bg-[#2d6a4f]/5 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/40"
              >
                {isSavingSimulation ? 'Saving…' : "Use and save this laptop's current time"}
              </button>
            </div>

            {simulationEnabled && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Simulated date and time (Asia/Manila)
                  <input
                    type="datetime-local"
                    value={simulatedAt}
                    onChange={(event) => setSimulatedAt(event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </label>
                <div className="flex flex-wrap gap-2" aria-label="Quick simulated time presets">
                  {[
                    ['9:00 AM (Not yet open)', '09:00'],
                    ['10:00 AM (Opening)', '10:00'],
                    ['2:00 PM (Open)', '14:00'],
                    ['10:30 PM (Last order)', '22:30'],
                    ['11:00 PM (Closed)', '23:00'],
                  ].map(([label, time]) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setPresetTime(time)}
                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#2d6a4f] hover:text-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p><span className="font-medium text-gray-700">Effective store time:</span> <span className="text-gray-900">{effectiveTime}</span></p>
              <p className="mt-1">
                <span className="font-medium text-gray-700">Ordering state:</span>{' '}
                <span className="text-gray-900">{storeHours ? stateLabels[storeHours.state] : 'Loading…'}</span>
                {storeHours?.simulation_enabled && (
                  <span className="ml-2 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-900">
                    Simulated time
                  </span>
                )}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingSimulation || (simulationEnabled && !simulatedAt)}
              className="rounded-lg bg-[#2d6a4f] px-5 py-2 font-semibold text-white hover:bg-[#24563f] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/40"
            >
              {isSavingSimulation ? 'Saving…' : 'Save simulation settings'}
            </button>
            {simulationMessage && <p role="status" className="text-sm text-gray-600">{simulationMessage}</p>}
          </form>
        )}
      </section>

      <section aria-labelledby="pricing-settings-title">
        <h2 id="pricing-settings-title" className="mb-4 text-lg font-semibold text-gray-800">Pricing settings</h2>
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
      </section>
    </div>
  );
};

export default AdminPricingSettingsPage;
