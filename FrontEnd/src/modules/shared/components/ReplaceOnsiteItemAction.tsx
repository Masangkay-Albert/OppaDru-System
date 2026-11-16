import React, { useState } from 'react';
import { API_URL } from '../../../services/apiConfig';

export interface ReplaceableOrderItem {
  id: number | string;
  product_name?: string;
  name?: string;
  quantity?: number;
}

interface ReplaceOnsiteItemActionProps {
  orderId: string;
  items: ReplaceableOrderItem[];
  endpointPrefix: string;
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  onComplete?: () => void;
}

const ReplaceOnsiteItemAction: React.FC<ReplaceOnsiteItemActionProps> = ({ orderId, items, endpointPrefix, fetcher, onComplete }) => {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await fetcher(`${API_URL}${endpointPrefix}/${encodeURIComponent(orderId)}/replace-onsite`, {
        method: 'POST',
        body: JSON.stringify({ item_id: Number(itemId), reason: reason.trim() }),
      });
      const payload = await response.json() as { message?: string; replacement_order?: { order_number?: string } };
      if (!response.ok) throw new Error(payload.message || 'Could not create the replacement order.');
      setSuccess(`Replacement order ${payload.replacement_order?.order_number || ''} created at no charge.`.trim());
      setOpen(false);
      setReason('');
      onComplete?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create the replacement order.');
    } finally {
      setSaving(false);
    }
  };

  if (!items.some((item) => Number.isInteger(Number(item.id)))) return null;

  return (
    <div className="mt-4">
      {success && <p role="status" className="mb-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg border border-emerald-200 px-4 text-sm font-semibold text-emerald-800">
          Replace item
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <label className="block text-sm font-semibold">
            Item to replace
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} required className="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-normal">
              <option value="">Choose an item</option>
              {items.filter((item) => Number.isInteger(Number(item.id))).map((item) => (
                <option key={item.id} value={item.id}>{item.quantity || 1}x {item.product_name || item.name || 'Item'}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Reason (3–200 characters)
            <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 200))} minLength={3} maxLength={200} required rows={2} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 font-normal" />
          </label>
          <p className="text-right text-xs text-gray-500">{reason.length}/200</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !itemId || reason.trim().length < 3} className="min-h-10 rounded-lg bg-[#276343] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create no-charge replacement'}</button>
            <button type="button" onClick={() => { setOpen(false); setError(''); }} className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReplaceOnsiteItemAction;
