// src/modules/customer-side/components/common/PromoBanner.tsx
import React, { useState, useEffect } from 'react';

interface Promo {
  id: string;
  title: string;
  description: string;
  validUntil: string;
}

const promos: Promo[] = [
  { id: '1', title: '🎉 Weekend Special', description: 'Buy 1 Take 1 on all Fried Chicken every Saturday & Sunday', validUntil: 'Every Weekend' },
  { id: '2', title: '₱99 Deal', description: 'Any Rice Meal + Iced Tea for only ₱99 (12PM - 3PM)', validUntil: 'Daily' },
  { id: '3', title: 'Family Bundle', description: 'Family Bucket + 1.5L Soda = ₱550 (Save ₱49)', validUntil: 'Limited Time' },
];

const PromoBanner: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % promos.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const currentPromo = promos[currentIndex];

  return (
    <div className="bg-[#C1440E] text-white py-3 px-5 relative overflow-hidden">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <strong className="text-white">{currentPromo.title}</strong>
          <span className="text-white/90">{currentPromo.description}</span>
        </div>
        <div className="bg-white/15 px-3 py-1 rounded-full text-xs">{currentPromo.validUntil}</div>
      </div>
      <div className="flex justify-center gap-2 mt-2">
        {promos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-1.5 rounded-full transition-all ${index === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PromoBanner;