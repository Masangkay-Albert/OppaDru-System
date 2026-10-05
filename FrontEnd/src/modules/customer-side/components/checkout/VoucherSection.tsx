// src/modules/customer-side/components/checkout/VoucherSection.tsx
import React, { useState } from 'react';
import { validateAndApplyVoucher } from '../../../../services/voucherService';

interface VoucherSectionProps {
  subtotal: number;
  onVoucherApplied: (discount: number) => void;
  onVoucherRemoved: () => void;
}

const VoucherSection: React.FC<VoucherSectionProps> = ({ 
  subtotal, 
  onVoucherApplied, 
  onVoucherRemoved 
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [hasAppliedVoucher, setHasAppliedVoucher] = useState(false);

  const handleApply = () => {
    const result = validateAndApplyVoucher(voucherCode, subtotal);
    if (result.isValid) {
      setHasAppliedVoucher(true);
      onVoucherApplied(result.discount);
      setVoucherError('');
    } else {
      setVoucherError(result.error || 'Invalid voucher');
    }
  };

  const handleRemove = () => {
    setHasAppliedVoucher(false);
    setVoucherCode('');
    onVoucherRemoved();
  };

  if (hasAppliedVoucher) {
    return (
      <div className="mb-4 p-3 bg-[#d8f3dc] rounded-xl flex justify-between items-center">
        <div>
          <p className="font-medium text-[#2d6a4f]">Voucher Applied</p>
          <p className="text-xs text-gray-500">Code: {voucherCode}</p>
        </div>
        <button onClick={handleRemove} className="text-red-500 text-sm">Remove</button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 pt-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 012 2v3a2 2 0 110 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 110-4V7a2 2 0 012-2z" />
        </svg>
        <h3 className="font-medium text-gray-800">Vouchers</h3>
      </div>
      
      <div className="checkout-voucher-control flex gap-2">
        <input 
          type="text" 
          value={voucherCode}
          onChange={(e) => setVoucherCode(e.target.value)}
          placeholder="Enter voucher code (OPPA10 or OPPA20)"
          className="checkout-voucher-input flex-1 px-4 py-2 border rounded-xl text-sm"
        />
        <button 
          onClick={handleApply}
          className="checkout-voucher-apply px-4 py-2 bg-[#2d6a4f] text-white rounded-xl text-sm font-medium hover:bg-[#1b4d3e] transition-colors"
        >
          Apply
        </button>
      </div>
      {voucherError && <p className="text-red-500 text-xs mt-2">{voucherError}</p>}
    </div>
  );
};

export default VoucherSection;