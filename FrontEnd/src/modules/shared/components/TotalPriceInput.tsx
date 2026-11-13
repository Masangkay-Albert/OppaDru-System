import React, { useState } from 'react';
import { isValidTotalPriceInput, MAX_TOTAL_PRICE_PAID_TEXT, sanitizeTotalPriceInput } from '../../../constants/inventoryUnits';

const fieldClass = 'mt-1 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)] focus:ring-2 focus:ring-[var(--oppa-green)]/20';
const labelClass = 'block text-sm font-medium text-[var(--oppa-text)]';

const priceText = (value: number, maxDecimals: number) => value.toLocaleString('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: maxDecimals,
});

export const TotalPriceInput: React.FC<{
  quantity: string;
  usageUnit: string;
  conversionFactor?: number;
  purchaseUnit?: string;
  label?: string;
  helperText?: string;
  alwaysShowPreview?: boolean;
  disabled?: boolean;
}> = ({
  quantity,
  usageUnit,
  conversionFactor = 1,
  purchaseUnit,
  label = 'Total price paid (optional)',
  helperText = 'How much did you pay for the quantity above?',
  alwaysShowPreview = false,
  disabled = false,
}) => {
  const [totalPrice, setTotalPrice] = useState('');
  const units = Number(quantity) * conversionFactor;
  const price = Number(totalPrice);
  const validPrice = totalPrice !== '' && isValidTotalPriceInput(totalPrice);
  const unitCost = validPrice && units > 0 ? price / units : null;
  const showConversion = Boolean(purchaseUnit && (purchaseUnit !== usageUnit || conversionFactor !== 1));
  const formattedUnits = units.toLocaleString('en-PH', { maximumFractionDigits: 3 });
  const preview = units <= 0
    ? 'Enter a quantity to see the price per piece'
    : unitCost === null
      ? 'Enter a total price to see the price per piece'
      : `= ₱${priceText(unitCost, 2)} each`;

  return (
    <label className={labelClass}>
      {label}
      {helperText && <span className="mt-0.5 block text-xs font-normal text-[var(--oppa-text-muted)]">{helperText}</span>}
      <span className="mt-1 flex">
        <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">₱</span>
        <input
          name="total_price_paid"
          type="text"
          inputMode="decimal"
          maxLength={10}
          disabled={disabled}
          value={totalPrice}
          onChange={(event) => setTotalPrice(sanitizeTotalPriceInput(event.target.value))}
          className={`${fieldClass} mt-0 rounded-l-none`}
          aria-label="Total price paid in Philippine pesos"
          aria-describedby="total-price-preview"
          placeholder="0.00"
        />
      </span>
      <span id="total-price-preview" aria-live="polite" className="mt-1 block text-xs font-normal text-[var(--oppa-text-muted)]">
        {showConversion && units > 0
          ? `${quantity} ${purchaseUnit} = ${formattedUnits} ${usageUnit}. Total ₱${validPrice ? priceText(price, 2) : '—'} = ₱${unitCost === null ? '—' : priceText(unitCost, 2)} each`
          : alwaysShowPreview
            ? `${formattedUnits || '0'} ${usageUnit} for ₱${validPrice ? priceText(price, 2) : '—'} = ₱${unitCost === null ? '—' : priceText(unitCost, 2)} each`
            : preview}
      </span>
      {totalPrice !== '' && !validPrice && <span className="mt-1 block text-xs font-normal text-red-700">Enter an amount from ₱0 to ₱{MAX_TOTAL_PRICE_PAID_TEXT}, with up to 2 decimal places.</span>}
    </label>
  );
};
