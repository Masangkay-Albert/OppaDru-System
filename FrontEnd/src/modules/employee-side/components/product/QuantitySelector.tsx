import React from 'react';

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({ 
  quantity, 
  onIncrease, 
  onDecrease, 
  min = 1 
}) => {
  return (
    <div className="inline-flex items-center border-2 border-gray-200 rounded-xl bg-white">
      <button 
        onClick={onDecrease} 
        disabled={quantity <= min}
        className="w-11 h-11 bg-gray-50 text-[#2d6a4f] font-bold text-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-xl"
      >
        -
      </button>
      <span className="min-w-[50px] text-center font-semibold text-base">{quantity}</span>
      <button 
        onClick={onIncrease}
        className="w-11 h-11 bg-gray-50 text-[#2d6a4f] font-bold text-xl hover:bg-gray-100 rounded-r-xl"
      >
        +
      </button>
    </div>
  );
};

export default QuantitySelector;
