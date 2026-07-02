// src/modules/customer-side/components/checkout/AddressSection.tsx
import React, { useState } from 'react';
import { FiMapPin, FiPlus } from 'react-icons/fi';
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
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [formData, setFormData] = useState<AddressDetails>(selectedDetails || {});

  const hasDetails = selectedDetails && Object.keys(selectedDetails).length > 0;

  const handleSaveDetails = () => {
    onSaveDetails(formData);
    setShowDetailsForm(false);
  };

  const fields = [
    { key: 'block', label: 'Block', placeholder: 'e.g., 12' },
    { key: 'lot', label: 'Lot', placeholder: 'e.g., 15' },
    { key: 'floor', label: 'Floor', placeholder: 'e.g., 2nd' },
    { key: 'unit', label: 'Unit', placeholder: 'e.g., A' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
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
        {addresses.length > 0 ? (
          addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              {...addr}
              isSelected={selectedId === addr.id}
              onSelect={() => onSelect(addr.id)}
              onEdit={() => onEdit(addr)}
              onDelete={() => onDelete(addr.id)}
              onSetDefault={() => onSetDefault(addr.id)}
            />
          ))
        ) : (
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
            <button
              onClick={() => {
                setShowDetailsForm(!showDetailsForm);
                if (!showDetailsForm) setFormData(selectedDetails || {});
              }}
              className="text-sm text-[#2d6a4f] font-medium hover:text-[#1b4d3e] transition"
            >
              {showDetailsForm ? 'Close' : hasDetails ? 'Edit Details' : 'Add Details'}
            </button>
          </div>

          {showDetailsForm ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {fields.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={formData[key as keyof AddressDetails] || ''}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
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
              <button
                onClick={handleSaveDetails}
                className="w-full py-2 bg-[#2d6a4f] text-white rounded-lg hover:bg-[#1b4d3e] transition font-medium text-sm"
              >
                Save Details
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              {hasDetails ? (
                <div className="space-y-1">
                  {selectedDetails.block && <p>Block: {selectedDetails.block}</p>}
                  {selectedDetails.lot && <p>Lot: {selectedDetails.lot}</p>}
                  {selectedDetails.floor && <p>Floor: {selectedDetails.floor}</p>}
                  {selectedDetails.unit && <p>Unit: {selectedDetails.unit}</p>}
                  {selectedDetails.building && <p>Building: {selectedDetails.building}</p>}
                  {selectedDetails.note && <p className="text-gray-400">Note: {selectedDetails.note}</p>}
                </div>
              ) : (
                <p className="text-gray-400">No additional details added yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddressSection;