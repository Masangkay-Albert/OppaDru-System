// src/modules/customer-side/components/checkout/AddressSection.tsx
import React, { useState } from 'react';
import { FiMapPin, FiPlus, FiCheck, FiEdit2 } from 'react-icons/fi';
import AddressCard from './AddressCard';
import type { SavedAddress } from '../../../../hooks/useAddressManagement';

interface AddressDetails {
  block?: string;
  lot?: string;
  floor?: string;
  unit?: string;
  building?: string;
  note?: string;
}

interface AddressSectionProps {
  addresses: SavedAddress[];
  selectedId: string;
  selectedDetails: AddressDetails;
  onSelect: (id: string) => void;
  onEdit: (address: SavedAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onAddNew: () => void;
  onSaveDetails: (details: AddressDetails) => void;
}

const AddressSection: React.FC<AddressSectionProps> = ({
  addresses,
  selectedId,
  selectedDetails,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  onAddNew,
  onSaveDetails
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<AddressDetails>(selectedDetails || {});

  const hasDetails = selectedDetails && Object.keys(selectedDetails).length > 0;

  const handleSaveDetails = () => {
    onSaveDetails(formData);
    setIsEditing(false); // Close form after save
  };

  const handleEditClick = () => {
    setFormData(selectedDetails || {});
    setIsEditing(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
            <FiMapPin className="text-[#2d6a4f]" size={18} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Delivery Address</h2>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center gap-1 text-sm text-[#2d6a4f] font-medium hover:text-[#1b4d3e] transition"
        >
          <FiPlus size={16} />
          Add New Address
        </button>
      </div>

      {/* Address List */}
      <div className="space-y-3">
        {addresses.map((addr) => {
          // Check if this address has details
          const addrHasDetails = addr.details && Object.keys(addr.details).length > 0;
          
          return (
            <AddressCard
              key={addr.id}
              {...addr}
              isSelected={selectedId === addr.id}
              onSelect={() => onSelect(addr.id)}
              onEdit={() => onEdit(addr)}
              onDelete={() => onDelete(addr.id)}
              onSetDefault={() => onSetDefault(addr.id)}
            />
          );
        })}

        {addresses.length === 0 && (
          <div className="text-center py-8">
            <FiMapPin className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No saved addresses yet</p>
            <button
              onClick={onAddNew}
              className="mt-3 text-[#2d6a4f] font-medium hover:underline"
            >
              Add your first address
            </button>
          </div>
        )}
      </div>

      {/* Additional Details */}
      {selectedId && addresses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Additional Details</h3>
            {!isEditing && hasDetails && (
              <button
                onClick={handleEditClick}
                className="text-sm text-[#2d6a4f] font-medium hover:text-[#1b4d3e] transition flex items-center gap-1"
              >
                <FiEdit2 size={14} />
                Edit Details
              </button>
            )}
            {!isEditing && !hasDetails && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setFormData({});
                }}
                className="text-sm text-[#2d6a4f] font-medium hover:text-[#1b4d3e] transition"
              >
                Add Details
              </button>
            )}
          </div>

          {isEditing ? (
            // EDIT MODE - Show form
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Block <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.block || ''}
                    onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                    placeholder="e.g., 12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Lot <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lot || ''}
                    onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                    placeholder="e.g., 15"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                  <input
                    type="text"
                    value={formData.floor || ''}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                    placeholder="e.g., 2nd"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                    placeholder="e.g., A"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Building</label>
                <input
                  type="text"
                  value={formData.building || ''}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                  placeholder="e.g., Building A"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note to Rider</label>
                <textarea
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition resize-none text-sm"
                  placeholder="Gate code, landmark, or special instructions..."
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveDetails}
                  className="flex-1 py-2.5 bg-[#2d6a4f] text-white rounded-lg hover:bg-[#1b4d3e] transition font-medium text-sm"
                >
                  Save Details
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(selectedDetails || {});
                  }}
                  className="px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // VIEW MODE - Show saved details only
            hasDetails && (
              <div className="text-sm text-gray-600 space-y-1 bg-[#f8fafc] rounded-lg p-3">
                {selectedDetails.block && (
                  <div className="flex items-center gap-2">
                    <FiCheck className="text-[#2d6a4f]" size={14} />
                    <span>Block: <span className="font-medium">{selectedDetails.block}</span></span>
                    {selectedDetails.lot && <span>| Lot: <span className="font-medium">{selectedDetails.lot}</span></span>}
                  </div>
                )}
                {selectedDetails.floor && <p className="ml-6">Floor: {selectedDetails.floor}</p>}
                {selectedDetails.unit && <p className="ml-6">Unit: {selectedDetails.unit}</p>}
                {selectedDetails.building && <p className="ml-6">Building: {selectedDetails.building}</p>}
                {selectedDetails.note && <p className="ml-6 text-gray-400 text-xs">📝 {selectedDetails.note}</p>}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default AddressSection;