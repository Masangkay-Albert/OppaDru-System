import React, { useState, useEffect } from 'react';
import { promoService, type Promo } from '../../../../services/promoService';

const PromoBanner: React.FC = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    promoService.getActivePromos().then((data) => {
      if (isMounted) {
        setPromos(data.filter(p => !p.is_expired && p.is_active));
      }
    }).catch(() => {
      if (isMounted) setPromos([]);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (promos.length <= 1) return;
    const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % promos.length), 5000);
    return () => clearInterval(interval);
  }, [promos.length]);

  if (promos.length === 0) {
    return null;
  }

  const currentPromo = promos[currentIndex] || promos[0];

  const getValidityDisplay = (promo: Promo) => {
    if (!promo.end_date) return 'Limited Time Offer';
    const end = new Date(promo.end_date);
    return `Valid until ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="bg-[var(--oppa-accent)] text-white py-3 px-5 relative overflow-hidden">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <strong className="text-white flex items-center gap-1.5">
            {currentPromo.title}
            {currentPromo.code && (
              <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {currentPromo.code}
              </span>
            )}
          </strong>
          {currentPromo.description && (
            <span className="text-white/90">{currentPromo.description}</span>
          )}
        </div>
        <div className="bg-white/15 px-3 py-1 rounded-full text-xs">{getValidityDisplay(currentPromo)}</div>
      </div>
      {promos.length > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          {promos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PromoBanner;
