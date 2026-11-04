// src/modules/customer-side/components/tracking/MapLegend.tsx
import React from 'react';
import oppaDeliveryIcon from '../../../../assets/oppa-dru-delivery.png';

const MapLegend: React.FC = () => {
  const legendItems = [
    { color: "border-[#2d6a4f]", label: "Route taken", type: "line" },
    { color: "border-[#e76f51]", label: "Remaining", type: "line", dashed: true },
    { color: "bg-white border-2 border-[#e76f51]", label: "Store", type: "circle" },
    { color: "bg-red-500", label: "Destination", type: "circle" },
    { icon: oppaDeliveryIcon, label: "Driver", type: "image" }
  ];

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-1 text-[9px] text-gray-500 sm:justify-center sm:gap-5 sm:text-xs">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {item.type === "line" && (
              <div className={`w-3 shrink-0 border-t-2 ${item.color} ${item.dashed ? 'border-dashed' : 'border-solid'} sm:w-4`}></div>
            )}
            {item.type === "circle" && (
              <div className={`size-2.5 shrink-0 rounded-full ${item.color} sm:size-3`}></div>
            )}
            {item.type === "image" && (
              <img src={item.icon} alt="" className="size-3 shrink-0 object-contain sm:size-4" />
            )}
            <span className="whitespace-nowrap">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;