// src/modules/customer-side/components/checkout/VoucherSection.tsx
import React, { useEffect, useState } from 'react';
import { validateVoucherAsync } from '../../../../services/voucherService';
import { promoService, type Promo } from '../../../../services/promoService';
import { formatPeso } from '../../../../utils/formatters';
import { Tag, Check, Sparkles, Loader2 } from 'lucide-react';

interface VoucherSectionProps {
  subtotal: number;
  onVoucherApplied: (discount: number, promo?: Promo) => void;
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
  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const [availablePromos, setAvailablePromos] = useState<Promo[]>([]);
  const [showPromoList, setShowPromoList] = useState(false);

  useEffect(() => {
    let active = true;
    promoService.getActivePromos()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setAvailablePromos(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleApplyCode = async (codeToApply: string) => {
    const code = codeToApply.trim();
    if (!code) {
      setVoucherError('Please enter a voucher code');
      return;
    }

    setIsValidating(true);
    setVoucherError('');

    try {
      const result = await validateVoucherAsync(code, subtotal);
      if (result.isValid) {
        setHasAppliedVoucher(true);
        setAppliedPromo(result.promo || null);
        setAppliedDiscount(result.discount);
        onVoucherApplied(result.discount, result.promo);
        setVoucherCode(code.toUpperCase());
        setVoucherError('');
        setShowPromoList(false);
      } else {
        setVoucherError(result.error || 'Invalid voucher code');
      }
    } catch {
      setVoucherError('Failed to validate promo code.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setHasAppliedVoucher(false);
    setAppliedPromo(null);
    setAppliedDiscount(0);
    setVoucherCode('');
    onVoucherRemoved();
  };

  if (hasAppliedVoucher) {
    return (
      <div className="mb-4 p-3.5 bg-[#d8f3dc] border border-[#2d6a4f]/30 rounded-xl flex justify-between items-center animate-fadeIn">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center">
            <Check size={16} />
          </div>
          <div>
            <p className="font-bold text-[#2d6a4f] text-sm">
              {appliedPromo?.title || 'Promo Code Applied'}
            </p>
            <p className="text-xs text-gray-600">
              Code: <span className="font-mono font-bold uppercase">{voucherCode}</span> · Saved {formatPeso(appliedDiscount)}
            </p>
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 pt-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--oppa-green)]" />
          <h3 className="font-bold text-gray-800 text-sm">Vouchers & Promos</h3>
        </div>
        {availablePromos.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPromoList(!showPromoList)}
            className="text-xs text-[var(--oppa-green)] hover:underline font-semibold flex items-center gap-1"
          >
            <Sparkles size={12} />
            {showPromoList ? 'Hide available promos' : `View promos (${availablePromos.length})`}
          </button>
        )}
      </div>

      {showPromoList && availablePromos.length > 0 && (
        <div className="mb-3 space-y-2 max-h-48 overflow-y-auto pr-1">
          {availablePromos.map((p) => {
            const discountLabel = p.discount_type === 'percent'
              ? `${p.discount_value}% OFF`
              : `${formatPeso(p.discount_value)} OFF`;
            return (
              <div
                key={p.id || p.code}
                onClick={() => handleApplyCode(p.code)}
                className="p-2.5 rounded-xl border border-gray-200 hover:border-[var(--oppa-green)] bg-gray-50 hover:bg-emerald-50/50 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--oppa-green)] px-1.5 py-0.5 bg-emerald-100 rounded">
                      {p.code}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{p.title}</span>
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                  {Number(p.min_order_amount) > 0 && (
                    <p className="text-[10px] text-gray-400">Min. spend: {formatPeso(Number(p.min_order_amount))}</p>
                  )}
                </div>
                <div className="text-right pl-2">
                  <span className="text-xs font-bold text-[#e76f51]">{discountLabel}</span>
                  <button
                    type="button"
                    className="block text-[10px] font-semibold text-[var(--oppa-green)] mt-0.5 hover:underline"
                  >
                    Apply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="checkout-voucher-control flex gap-2">
        <input 
          type="text" 
          value={voucherCode}
          onChange={(e) => {
            setVoucherCode(e.target.value.toUpperCase());
            if (voucherError) setVoucherError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleApplyCode(voucherCode);
            }
          }}
          placeholder="Enter promo code (e.g. OPPA10, WEEKEND15)"
          className="checkout-voucher-input flex-1 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] uppercase"
        />
        <button 
          type="button"
          disabled={isValidating || !voucherCode.trim()}
          onClick={() => void handleApplyCode(voucherCode)}
          className="checkout-voucher-apply px-4 py-2 bg-[#2d6a4f] text-white rounded-xl text-sm font-medium hover:bg-[#1b4d3e] transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isValidating && <Loader2 size={14} className="animate-spin" />}
          <span>{isValidating ? 'Checking...' : 'Apply'}</span>
        </button>
      </div>
      {voucherError && <p className="text-red-500 text-xs mt-2">{voucherError}</p>}
    </div>
  );
};

export default VoucherSection;
