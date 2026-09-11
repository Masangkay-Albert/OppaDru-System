import React from 'react';
import { formatCurrency } from '../../../../utils/formatters';

interface POSCashCalculatorProps {
  totalDue: number;
  cashTendered: number;
  onCashTenderedChange: (val: number) => void;
}

const POSCashCalculator: React.FC<POSCashCalculatorProps> = ({
  totalDue,
  cashTendered,
  onCashTenderedChange,
}) => {
  const changeDue = Math.max(0, cashTendered - totalDue);
  const isInsufficient = cashTendered > 0 && cashTendered < totalDue;

  const quickAmounts = [
    { label: 'Exact', value: Math.ceil(totalDue) },
    { label: '₱100', value: 100 },
    { label: '₱200', value: 200 },
    { label: '₱500', value: 500 },
    { label: '₱1,000', value: 1000 },
  ];

  return (
    <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-[#fbfdfa] space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Cash Tendered (₱)
        </label>
        <span className="text-xs text-gray-500">
          Amount Due: <strong className="text-gray-800">{formatCurrency(totalDue)}</strong>
        </span>
      </div>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-base">
          ₱
        </span>
        <input
          type="number"
          step="any"
          min="0"
          value={cashTendered === 0 ? '' : cashTendered}
          onChange={(e) => onCashTenderedChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-300 text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent bg-white shadow-inner"
        />
      </div>

      {/* Quick Cash Buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {quickAmounts.map((btn, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onCashTenderedChange(btn.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              cashTendered === btn.value
                ? 'bg-[var(--oppa-green)] text-white border-[var(--oppa-green)] shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Change Due Calculation */}
      <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Change Due:</span>
        <span
          className={`text-lg font-extrabold ${
            isInsufficient
              ? 'text-red-500'
              : cashTendered >= totalDue
              ? 'text-[var(--oppa-green)]'
              : 'text-gray-400'
          }`}
        >
          {isInsufficient
            ? `Short by ${formatCurrency(totalDue - cashTendered)}`
            : formatCurrency(changeDue)}
        </span>
      </div>
    </div>
  );
};

export default POSCashCalculator;
