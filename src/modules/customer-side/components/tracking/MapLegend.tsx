// src/modules/customer-side/components/tracking/MapLegend.tsx
import React from 'react';
import oppaDeliveryIcon from '../../../../assets/oppa-dru-delivery.png';

const MapLegend: React.FC = () => {
  const legendItems = [
    { color: "bg-[#2d6a4f]", label: "Route taken", type: "line" },
    { color: "bg-[#e76f51]", label: "Remaining", type: "line", dashed: true },
    { color: "bg-white border-2 border-[#e76f51]", label: "Store", type: "circle" },
    { color: "bg-red-500", label: "Destination", type: "circle" },
    { icon: oppaDeliveryIcon, label: "Driver", type: "image" }
  ];

  return (
    <div className="p-3 bg-[#fdf4e6] border-t border-[#e76f51]/20">
      <div className="flex items-center justify-center gap-5 text-xs flex-wrap">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {item.type === "line" && (
              <div className={`w-4 h-0.5 ${item.color} ${item.dashed ? 'border-t border-dashed' : ''}`}></div>
            )}
            {item.type === "circle" && (
              <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
            )}
            {item.type === "image" && (
              <img src={item.icon} alt={item.label} className="w-4 h-4 object-contain" />
            )}
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;