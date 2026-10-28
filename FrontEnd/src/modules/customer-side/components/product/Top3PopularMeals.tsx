import React, { useEffect, useState } from 'react';
import { Flame, Trophy, Plus } from 'lucide-react';
import { formatPeso } from '../../../../utils/formatters';
import type { Product } from '../../../../services/productService';
import { API_URL } from '../../../../services/apiConfig';

interface PopularMeal {
  rank: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  image?: string | null;
  image_url?: string | null;
  quantity_sold: number;
  revenue?: number;
}

interface Top3PopularMealsProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  className?: string;
}

const Top3PopularMeals: React.FC<Top3PopularMealsProps> = ({
  products,
  onSelectProduct,
  className = '',
}) => {
  const [top3, setTop3] = useState<PopularMeal[]>([]);
  const [monthName, setMonthName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchTop3 = async () => {
      try {
        const res = await fetch(`${API_URL}/reports/popular-meals?limit=3`);
        if (res.ok) {
          const json = await res.json();
          if (active && Array.isArray(json.top_meals) && json.top_meals.length > 0) {
            setTop3(json.top_meals.slice(0, 3));
            setMonthName(json.month_name || '');
          }
        }
      } catch (e) {
        console.warn('Could not load top 3 popular meals', e);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchTop3();
    return () => {
      active = false;
    };
  }, []);

  const handleSelect = (meal: PopularMeal) => {
    const matched = products.find(
      (p) => p.id === meal.product_id || p.name.toLowerCase() === meal.name.toLowerCase(),
    );
    if (matched) {
      onSelectProduct(matched);
    } else {
      const fallback: Product = {
        id: meal.product_id,
        name: meal.name,
        price: Number(meal.price),
        category: meal.category || 'meal',
        description: `Customer favorite this month (#${meal.rank})`,
        image: meal.image || meal.image_url || null,
        is_available: true,
      };
      onSelectProduct(fallback);
    }
  };

  if (isLoading || top3.length === 0) {
    return null;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const badgeColors = [
    'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
    'bg-gradient-to-r from-slate-400 to-slate-500 text-white',
    'bg-gradient-to-r from-amber-700 to-orange-800 text-white',
  ];

  return (
    <section aria-label="Top 3 most popular meals this month" className={`mb-8 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
            <Flame size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              Top 3 Most Popular This Month
              {monthName && <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full hidden sm:inline">{monthName}</span>}
            </h2>
            <p className="text-xs text-gray-500">Highest customer-rated and ordered dishes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((meal, index) => (
          <article
            key={meal.product_id}
            onClick={() => handleSelect(meal)}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-amber-200/90 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs ${badgeColors[index] || 'bg-gray-800 text-white'}`}>
                <span>{medals[index] || `#${meal.rank}`}</span>
                <span>#{meal.rank} Best Seller</span>
              </span>
              <span className="text-xs font-semibold text-gray-400">
                {meal.quantity_sold} sold
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              {meal.image ? (
                <img
                  src={meal.image}
                  alt={meal.name}
                  className="size-16 rounded-xl object-cover shadow-xs group-hover:scale-105 transition-transform shrink-0"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Trophy size={28} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-base font-bold text-gray-900 group-hover:text-[#2d6a4f] transition-colors">
                  {meal.name}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 capitalize">{meal.category.replaceAll('-', ' ')}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-bold text-sm text-[#2d6a4f] tabular-nums">
                    {formatPeso(Number(meal.price))}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(meal);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[#2d6a4f] px-2.5 py-1 text-xs font-bold text-white transition hover:bg-[#1b4332] shadow-2xs"
                  >
                    <Plus size={13} />
                    <span>Order</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Top3PopularMeals;

