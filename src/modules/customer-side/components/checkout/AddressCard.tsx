// src/modules/customer-side/components/checkout/AddressCard.tsx
import React from 'react';
import { FiCheck, FiHome, FiEdit2, FiTrash2 } from 'react-icons/fi';

interface AddressCardProps {
  id: string;
  name: string;
  address: string;
  isDefault: boolean;
  isSelected: boolean;
  label?: string;
  details?: {
    block?: string;
    lot?: string;
    floor?: string;
    unit?: string;
    building?: string;
    note?: string;
  };
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const AddressCard: React.FC<AddressCardProps> = ({
  name,
  address,
  isDefault,
  isSelected,
  label,
  details,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault
}) => {
  const hasDetails = details && Object.keys(details).length > 0;

  return (
    <div
      className={`border-2 rounded-xl p-4 transition cursor-pointer ${
        isSelected
          ? 'border-[#2d6a4f] bg-[#f0fdf4]'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-800 truncate">{name}</span>
            {isDefault && (
              <span className="text-xs bg-[#2d6a4f] text-white px-2 py-0.5 rounded-full flex-shrink-0">DEFAULT</span>
            )}
            {isSelected && <FiCheck className="text-[#2d6a4f] flex-shrink-0" size={16} />}
            {label && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">{label}</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1 truncate">{address}</p>
          {hasDetails && (
            <div className="text-xs text-gray-500 mt-1 space-x-2 truncate">
              {details.block && <span>Block {details.block}</span>}
              {details.lot && <span>Lot {details.lot}</span>}
              {details.floor && <span>Floor {details.floor}</span>}
              {details.unit && <span>Unit {details.unit}</span>}
              {details.building && <span>{details.building}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-4 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 text-gray-400 hover:text-[#2d6a4f] hover:bg-[#f0fdf4] rounded-lg transition"
          >
            <FiEdit2 size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
            className={`p-2 rounded-lg transition ${
              isDefault
                ? 'text-[#2d6a4f] bg-[#f0fdf4] cursor-default'
                : 'text-gray-400 hover:text-[#2d6a4f] hover:bg-[#f0fdf4]'
            }`}
            title={isDefault ? 'Default Address' : 'Set as Default'}
          >
            <FiHome size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressCard;