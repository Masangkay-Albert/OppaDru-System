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
  { id: 'fruity-soda-milk' as ProductCategory, name: 'Fruity Soda' },
  { id: 'noodles' as ProductCategory, name: 'Noodles' },
  { id: 'fresh-lemonade' as ProductCategory, name: 'Non-Coffee' },
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
  const displayName = userName || 'Guest';

  return (
    <div className="menu-greeting bg-[var(--oppa-green-dark)] rounded-2xl p-6 mb-6 text-white shadow-md">
      <h2 className="menu-greeting-title text-xl sm:text-2xl font-serif font-bold mb-1 text-[var(--oppa-cream)]">
        {greeting}, {displayName}!
      </h2>
      <p className="menu-greeting-subtitle text-[var(--oppa-green-soft)] text-sm mb-4">What are you craving today?</p>

      <div className="menu-category-pills flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className="menu-category-pill px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-[var(--oppa-cream)] border border-white/15 hover:bg-white/20 transition-all"
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GreetingBanner;