import React from 'react';
import type { ProductCategory } from '../../../../types/product.types';

interface GreetingBannerProps {
  userName?: string;
  onCategoryClick: (category: ProductCategory) => void;
}

const categories = [
  { id: 'rice-meals' as ProductCategory, name: 'Rice Meals' },
  { id: 'chicken' as ProductCategory, name: 'Chicken' },
  { id: 'sulit-meals' as ProductCategory, name: 'Sulit Meals' },
  { id: 'beverages' as ProductCategory, name: 'Beverages' },
  { id: 'snacks' as ProductCategory, name: 'Snacks' },
  { id: 'side-dishes' as ProductCategory, name: 'Side Dishes' },
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
    <div className="bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] rounded-2xl p-6 mb-6 text-white shadow-xl">
      <h2 className="text-xl sm:text-2xl font-serif font-bold mb-1">
        {greeting}, {displayName}!
      </h2>
      <p className="text-[#d8f3dc] text-sm mb-4">What are you craving today?</p>
      
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white/20 text-white hover:bg-white/30 transition-all hover:scale-105"
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GreetingBanner;