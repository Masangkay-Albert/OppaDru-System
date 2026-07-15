// src/modules/customer-side/components/tracking/ProgressBar.tsx
import React from 'react';
import { ORDER_STATUS } from '../../../../utils/constants';

interface ProgressBarProps {
  status: string;
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
  const steps = [
    { label: "Order placed", value: 25 },
    { label: "Preparing", value: 50 },
    { label: "On the way", value: 75 },
    { label: "Delivered", value: 100 }
  ];

  const getCurrentStep = () => {
    switch(status) {
      case ORDER_STATUS.PENDING: return 0;
      case ORDER_STATUS.PREPARING: return 1;
      case ORDER_STATUS.ON_WAY: return 2;
      case ORDER_STATUS.DELIVERED: return 3;
      default: return 0;
    }
  };

  const currentStep = getCurrentStep();

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 border border-[#e76f51]/20">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        {steps.map((step, index) => (
          <span 
            key={step.label} 
            className={`transition-colors duration-300 ${
              index <= currentStep ? 'text-[#2d6a4f] font-medium' : 'text-gray-400'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-[#2d6a4f] transition-all duration-1000 ease-in-out rounded-full" 
          style={{ width: `${Math.min(progress, 100)}%` }} 
        />
      </div>
    </div>
  );
};

export default ProgressBar;