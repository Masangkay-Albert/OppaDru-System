// src/modules/customer-side/components/tracking/ProgressBar.tsx
import React from 'react';
import { ORDER_STATUS } from '../../../../utils/constants';

interface ProgressBarProps {
  status: string;
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
  const steps = [
    { label: "Order placed" },
    { label: "Preparing" },
    { label: "Prepared" },
    { label: "On the way" },
    { label: "Delivered" }
  ];

  const getCurrentStep = () => {
    switch(status) {
      case ORDER_STATUS.PENDING: return 0;
      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.PREPARING: return 1;
      case ORDER_STATUS.PREPARED:
      case ORDER_STATUS.READY: return 2;
      case ORDER_STATUS.ON_WAY: return 3;
      case ORDER_STATUS.ARRIVING:
      case ORDER_STATUS.ARRIVED: return 3;
      case ORDER_STATUS.DELIVERED:
      case ORDER_STATUS.COMPLETED: return 4;
      default: return 0;
    }
  };

  const currentStep = getCurrentStep();
  const fillProgress = Math.min(100, Math.max(0, progress));

  return (
    <div role="group" aria-label="Order progress" className="relative">
      <div className="relative z-10 grid grid-cols-5">
        {steps.map((step, index) => (
          <div key={step.label} className={`relative z-10 flex min-w-0 flex-col items-center gap-2 text-center text-[10px] transition-colors duration-300 sm:text-sm ${index <= currentStep ? 'font-semibold text-[#2d6a4f]' : 'text-gray-400'}`}>
            <span className={`grid size-3.5 place-items-center rounded-full border-2 transition-colors duration-300 sm:size-4 ${
              index < currentStep
                ? 'border-[#2d6a4f] bg-[#2d6a4f]'
                : index === currentStep
                  ? 'border-[#2d6a4f] bg-white ring-2 ring-[#2d6a4f]/20'
                  : 'border-gray-300 bg-white'
            }`}>
              {index < currentStep && <span className="size-1.5 rounded-full bg-white" />}
            </span>
            <span className="max-w-full whitespace-normal leading-tight">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="absolute left-[10%] right-[10%] top-[7px] z-0 h-1.5 overflow-hidden rounded-full bg-gray-200 sm:top-2">
        <div 
          className="h-full rounded-full bg-[#2d6a4f] transition-all duration-1000 ease-in-out"
          style={{ width: `${fillProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
