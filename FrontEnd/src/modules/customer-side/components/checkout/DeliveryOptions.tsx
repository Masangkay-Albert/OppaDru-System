// src/modules/customer-side/components/checkout/DeliveryOptions.tsx
import React from 'react';
import { formatCurrency } from '../../../../utils/formatters';

interface DeliveryOptionsProps {
  deliveryOption: 'standard' | 'priority' | 'scheduled';
  onOptionChange: (option: 'standard' | 'priority' | 'scheduled') => void;
  scheduleDisplay: string;
  onScheduleClick: () => void;
}

const DeliveryOptions: React.FC<DeliveryOptionsProps> = ({ 
  deliveryOption, onOptionChange, scheduleDisplay, onScheduleClick 
}) => {
  return (
    <div className="checkout-section checkout-delivery-card bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Delivery options</h2>
      </div>
      
      <div className="space-y-3">
        <label className="checkout-radio-card checkout-delivery-option flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51]">
          <div className="flex items-center gap-3">
            <input type="radio" name="delivery" checked={deliveryOption === 'standard'} onChange={() => onOptionChange('standard')} className="accent-[#2d6a4f]" />
            <div>
              <span className="font-medium">Standard</span>
              <p className="text-xs text-gray-400">35-50 mins</p>
            </div>
          </div>
        </label>
        
        <label className="checkout-radio-card checkout-delivery-option flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51]">
          <div className="flex items-center gap-3">
            <input type="radio" name="delivery" checked={deliveryOption === 'priority'} onChange={() => onOptionChange('priority')} className="accent-[#2d6a4f]" />
            <div>
              <span className="font-medium">Priority</span>
              <p className="text-xs text-gray-400">30-45 mins</p>
            </div>
          </div>
          <span className="font-medium text-[#e76f51]">{formatCurrency(99)}</span>
        </label>
        
        <label className="checkout-radio-card checkout-delivery-option flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51]">
          <div className="flex items-center gap-3">
            <input type="radio" name="delivery" checked={deliveryOption === 'scheduled'} onChange={onScheduleClick} className="accent-[#2d6a4f]" />
            <div>
              <span className="font-medium">Scheduled</span>
              <p className="text-xs text-gray-400">{scheduleDisplay}</p>
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};

export default DeliveryOptions;