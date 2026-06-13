import React from 'react';
import { ORDER_STATUS } from '../../../../utils/constants';

interface ProgressBarProps {
  status: string;
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
  const steps = [
    { label: "Order placed", status: ORDER_STATUS.PREPARING },
    { label: "Preparing", status: ORDER_STATUS.ON_THE_WAY },
    { label: "On the way", status: ORDER_STATUS.ARRIVING_SOON },
    { label: "Delivered", status: ORDER_STATUS.DELIVERED }
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 mb-4 border border-[#e76f51]/20">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        {steps.map((step) => (
          <span key={step.label} className={status === step.status ? 'text-[#2d6a4f] font-medium' : ''}>
            {step.label}
          </span>
        ))}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#2d6a4f] transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;