import React from 'react';
import type { ProductCategory } from '../../../../types/product.types';

interface GreetingBannerProps {
  userName?: string;
  onCategoryClick: (category: ProductCategory) => void;
}

const categories = [
  { id: 'rice-meals' as ProductCategory, name: 'Rice Meals' },
  { id: 'chicken' as ProductCategory, name: 'Chicken' },
  { id: 'snacks' as ProductCategory, name: 'Snacks' },
  { id: 'fruity-soda-milk' as ProductCategory, name: 'Fruity Soda & Milk' },
  { id: 'noodles' as ProductCategory, name: 'Noodles' },
  { id: 'fresh-lemonade' as ProductCategory, name: 'Fresh Lemonade' },
];

const GreetingBanner: React.FC<GreetingBannerProps> = ({
  userName,
  onCategoryClick
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const greeting = getGreeting();
  const displayName = userName || 'Staff';

  return (
    <div className="bg-[var(--oppa-green-dark)] rounded-2xl p-6 mb-6 text-white shadow-md">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold mb-1 text-[var(--oppa-cream)]">
            {greeting}, {displayName}!
          </h2>
          <p className="text-[var(--oppa-green-soft)] text-sm mb-4">Onsite POS Register active & ready</p>
        </div>
        <span className="bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-[var(--oppa-cream)]">
          Counter Register
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-[var(--oppa-cream)] border border-white/15 hover:bg-white/20 transition-all"
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GreetingBanner;

