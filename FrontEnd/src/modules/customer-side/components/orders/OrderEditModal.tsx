import React from 'react';
import { getOrderGraceRemainingSeconds } from '../../../../utils/orderManagement';
import { formatCurrency } from '../../../../utils/formatters';

interface OrderEditModalProps {
  editingOrder: any;
  graceStartedAtByOrder: Record<string, number>;
  editDraft: any[];
  isSavingEdit: boolean;
  onClose: () => void;
  onSave: () => void;
  onToggleAddon: (itemIndex: number, addonId: string | undefined) => void;
  onUpdateQuantity: (itemIndex: number, delta: number) => void;
  onRemoveItem: (itemIndex: number) => void;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({
  editingOrder,
  graceStartedAtByOrder,
  editDraft,
  isSavingEdit,
  onClose,
  onSave,
  onToggleAddon,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  if (!editingOrder) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-[#2d6a4f]">Edit Order</h3>
            <p className="text-xs text-gray-500">You can still edit this order for {Math.ceil(getOrderGraceRemainingSeconds(editingOrder, graceStartedAtByOrder))}s</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
          {editDraft.map((item: any, itemIndex: number) => (
            <div key={`${item.id}-${itemIndex}`} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.price || 0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onUpdateQuantity(itemIndex, -1)} className="h-7 w-7 rounded-full border border-gray-200 text-lg">-</button>
                  <span className="min-w-5 text-center text-sm font-medium">{item.quantity || 1}</span>
                  <button type="button" onClick={() => onUpdateQuantity(itemIndex, 1)} className="h-7 w-7 rounded-full border border-gray-200 text-lg">+</button>
                  <button type="button" onClick={() => onRemoveItem(itemIndex)} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">Remove</button>
                </div>
              </div>

              {(item.selected_addons || item.selectedAddons || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(item.selected_addons || item.selectedAddons || []).map((addon: any, addonIndex: number) => {
                    const isSelected = (item.selected_addons || []).some((selectedAddon: any) => String(selectedAddon.id) === String(addon.id));
                    return (
                      <label key={`${addon.id || addonIndex}-${addonIndex}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleAddon(itemIndex, addon.id)}
                            className="h-4 w-4 accent-[#2d6a4f]"
                          />
                          <span>{addon.name}</span>
                        </div>
                        <span className="text-[#e76f51]">+ {formatCurrency(addon.price || 0)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600">Cancel</button>
          <button type="button" onClick={onSave} disabled={isSavingEdit || editDraft.length === 0} className="rounded-lg bg-[#2d6a4f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isSavingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
