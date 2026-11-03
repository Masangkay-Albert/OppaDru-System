// src/modules/customer-side/components/checkout/VoucherSection.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { validateVoucherAsync } from '../../../../services/voucherService';
import type { CartItem } from '../../../../types/product.types';
import { formatPeso } from '../../../../utils/formatters';
import { Tag, Check, Loader2, X } from 'lucide-react';

interface VoucherSectionProps {
  cartItems: CartItem[];
  branchId?: string | null;
  onVoucherApplied: (discount: number, promo?: { code: string }) => void;
  onVoucherRemoved: () => void;
}

const VoucherSection: React.FC<VoucherSectionProps> = ({
  cartItems,
  branchId,
  onVoucherApplied, 
  onVoucherRemoved 
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const requestId = useRef(0);
  const callbacksRef = useRef({ onVoucherApplied, onVoucherRemoved });
  const validatedCartSignature = useRef('');
  const promoItems = useMemo(() => cartItems.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    selected_size: item.selectedSize,
    selected_addons: (item.selectedAddons || []).map((addon) => ({ id: addon.id, quantity: addon.quantity || 1 })),
  })), [cartItems]);
  const cartSignature = JSON.stringify({ branchId, items: promoItems });

  useEffect(() => {
    callbacksRef.current = { onVoucherApplied, onVoucherRemoved };
  }, [onVoucherApplied, onVoucherRemoved]);

  useEffect(() => {
    if (!appliedCode) return undefined;
    if (validatedCartSignature.current === cartSignature) return undefined;
    validatedCartSignature.current = cartSignature;
    const currentRequestId = ++requestId.current;
    let active = true;
    void validateVoucherAsync(appliedCode, promoItems, 'customer', branchId).then((result) => {
      if (!active || requestId.current !== currentRequestId) return;
      if (result.isValid) {
        setAppliedDiscount(result.discount);
        callbacksRef.current.onVoucherApplied(result.discount, { code: result.code || appliedCode });
      } else {
        setAppliedCode('');
        setAppliedDiscount(0);
        setVoucherCode(appliedCode);
        setVoucherError(result.error || 'Something went wrong. Please try again.');
        callbacksRef.current.onVoucherRemoved();
      }
    });
    return () => {
      active = false;
    };
  }, [cartSignature, appliedCode, branchId, promoItems]);

  const handleApplyCode = async () => {
    if (isValidating) return;
    const code = voucherCode.trim().replace(/\s+/g, '').toUpperCase();
    if (!code) {
      setVoucherError('Please enter a promo code.');
      return;
    }

    setIsValidating(true);
    setVoucherError('');

    try {
      const result = await validateVoucherAsync(code, promoItems, 'customer', branchId);
      if (result.isValid) {
        const applied = result.code || code;
        validatedCartSignature.current = cartSignature;
        setAppliedCode(applied);
        setAppliedDiscount(result.discount);
        onVoucherApplied(result.discount, { code: applied });
        setVoucherError('');
      } else {
        setVoucherError(result.error || 'Invalid voucher code');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    requestId.current += 1;
    validatedCartSignature.current = '';
    setAppliedCode('');
    setAppliedDiscount(0);
    setVoucherCode('');
    setVoucherError('');
    onVoucherRemoved();
  };

  if (appliedCode) {
    return (
      <div className="checkout-applied-promo mb-4 rounded-xl p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
              <Check size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="checkout-applied-promo-title truncate text-sm font-bold">Promo {appliedCode} applied</p>
              <p className="checkout-applied-promo-savings text-xs">You save {formatPeso(appliedDiscount)}</p>
            </div>
          </div>
          <button type="button" onClick={handleRemove} className="checkout-applied-promo-remove min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 pt-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--oppa-green)]" />
          <h3 className="checkout-voucher-heading text-sm font-bold">Have a promo code?</h3>
        </div>
      </div>

      <div className="checkout-voucher-control flex gap-2">
        <input 
          type="text" 
          value={voucherCode}
          onChange={(e) => {
            setVoucherCode(e.target.value.replace(/\s+/g, '').toUpperCase());
            if (voucherError) setVoucherError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleApplyCode();
            }
          }}
          aria-label="Promo code"
          aria-invalid={Boolean(voucherError)}
          aria-describedby={voucherError ? 'promo-code-error' : undefined}
          placeholder="Enter promo code"
          className="checkout-voucher-input min-h-11 flex-1 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] uppercase"
        />
        <button 
          type="button"
          disabled={isValidating}
          onClick={() => void handleApplyCode()}
          className="checkout-voucher-apply min-h-11 px-4 py-2 bg-[#2d6a4f] text-white rounded-xl text-sm font-medium hover:bg-[#1b4d3e] transition-colors disabled:opacity-50 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50"
        >
          {isValidating && <Loader2 size={14} className="animate-spin" />}
          <span>{isValidating ? 'Checking...' : 'Apply'}</span>
        </button>
      </div>
      {voucherError && <p id="promo-code-error" className="checkout-voucher-error mt-2 flex items-start gap-1.5" role="status" aria-live="polite"><X size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{voucherError}</span></p>}
    </div>
  );
};

export default VoucherSection;
