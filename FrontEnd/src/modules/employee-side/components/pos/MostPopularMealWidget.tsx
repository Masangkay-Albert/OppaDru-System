import React, { useEffect, useState, useCallback } from 'react';
import { Flame, Trophy, Plus, ChevronRight, X, Check } from 'lucide-react';
import { formatPeso } from '../../../../utils/formatters';
import { fetchWithEmployeeAuth } from '../../../../services/employeeAuth';
import type { Product } from '../../../../services/productService';

export interface PopularMealItem {
  rank: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  image?: string | null;
  image_url?: string | null;
  quantity_sold: number;
  revenue: number;
  relative_percentage?: number;
  share_percentage?: number;
}

interface PopularMealsResponse {
  month_name: string;
  total_orders: number;
  total_quantity_sold: number;
  top_meals: PopularMealItem[];
}

interface MostPopularMealWidgetProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  className?: string;
}

const MostPopularMealWidget: React.FC<MostPopularMealWidgetProps> = ({
  products,
  onSelectProduct,
  className = '',
}) => {
  const [data, setData] = useState<PopularMealsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addedMealId, setAddedMealId] = useState<string | null>(null);

  const fetchPopular = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithEmployeeAuth('/cashier/popular-meals?limit=10');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Unable to load popular meals for POS widget', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPopular();
  }, [fetchPopular]);

  const topMeals = data?.top_meals || [];
  const top1 = topMeals[0];
  const runnersUp = topMeals.slice(1, 3);

  const handleAddMeal = (meal: PopularMealItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const matched = products.find(
      (p) => p.id === meal.product_id || p.name.toLowerCase() === meal.name.toLowerCase(),
    );

    if (matched) {
      onSelectProduct(matched);
      setAddedMealId(meal.product_id);
      setTimeout(() => setAddedMealId(null), 1200);
    } else {
      const fallbackProduct: Product = {
        id: meal.product_id,
        name: meal.name,
        price: Number(meal.price),
        category: meal.category || 'meal',
        description: `Most popular item this month (#${meal.rank})`,
        image: meal.image || meal.image_url || null,
        is_available: true,
      };
      onSelectProduct(fallbackProduct);
      setAddedMealId(meal.product_id);
      setTimeout(() => setAddedMealId(null), 1200);
    }
  };

  if (isLoading && !data) {
    return (
      <div className={`rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 shadow-xs animate-pulse ${className}`}>
        <div className="h-4 w-48 rounded bg-amber-200/60 mb-2"></div>
        <div className="h-10 w-full rounded-xl bg-amber-200/40"></div>
      </div>
    );
  }

  if (!top1) {
    return null;
  }

  return (
    <>
      <section
        aria-label="Top 3 most popular meals this month"
        className={`relative overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50 via-[#fff8eb] to-orange-50/70 p-3.5 sm:p-4 shadow-sm transition hover:shadow-md ${className}`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                <Flame size={24} className="animate-bounce" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950 ring-2 ring-white">
                #1
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-900">
                  <Trophy size={11} className="text-amber-700" /> Top 3 Most Popular This Month
                </span>
                {data?.month_name && (
                  <span className="text-[11px] font-medium text-amber-800/80 hidden sm:inline">
                    ({data.month_name})
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <h3 className="truncate font-serif text-base sm:text-lg font-bold text-gray-900">
                  {top1.name}
                </h3>
                <span className="font-bold tabular-nums text-emerald-800 text-sm">
                  {formatPeso(Number(top1.price))}
                </span>
                <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 shadow-2xs">
                  🔥 {top1.quantity_sold} sold
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={(e) => handleAddMeal(top1, e)}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                addedMealId === top1.product_id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white'
              }`}
            >
              {addedMealId === top1.product_id ? (
                <>
                  <Check size={14} /> Added!
                </>
              ) : (
                <>
                  <Plus size={14} /> Add #1 to Order
                </>
              )}
            </button>

            {runnersUp.map((runner) => (
              <button
                key={runner.product_id}
                type="button"
                onClick={(e) => handleAddMeal(runner, e)}
                title={`Add #${runner.rank} ${runner.name} (${formatPeso(runner.price)})`}
                className="hidden xl:flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-white/90 px-2.5 py-2 text-xs font-semibold text-gray-800 hover:bg-amber-100/60 transition shadow-2xs"
              >
                <span className="font-extrabold text-amber-600">#{runner.rank}</span>
                <span className="max-w-[110px] truncate">{runner.name}</span>
                <Plus size={12} className="text-gray-400" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex min-h-10 items-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 transition shadow-2xs"
            >
              <span>Top 10 Meals</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="popular-meals-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setShowModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                  <Flame size={20} />
                </div>
                <div>
                  <h2 id="popular-meals-modal-title" className="font-serif text-lg font-bold text-gray-900">
                    Most Popular Meals This Month
                  </h2>
                  <p className="text-xs text-gray-500">
                    {data?.month_name || 'Current Month'} · Tap any meal to add directly to current order
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex size-9 items-center justify-center rounded-full bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition shadow-xs"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-gray-100">
              {topMeals.map((meal) => {
                const isTop1 = meal.rank === 1;
                return (
                  <div
                    key={meal.product_id}
                    className={`flex items-center justify-between gap-3 py-3 transition ${
                      isTop1 ? 'bg-amber-50/50 rounded-2xl px-3' : 'hover:bg-gray-50 rounded-xl px-2'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl font-black text-xs ${
                          meal.rank === 1
                            ? 'bg-amber-500 text-white shadow-xs'
                            : meal.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : meal.rank === 3
                            ? 'bg-amber-700/80 text-white'
                            : 'bg-gray-100 text-gray-600 font-bold'
                        }`}
                      >
                        {meal.rank === 1 ? '🥇' : meal.rank === 2 ? '🥈' : meal.rank === 3 ? '🥉' : `#${meal.rank}`}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{meal.name}</h4>
                          {isTop1 && (
                            <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[9px] font-black text-amber-900">
                              TOP #1
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-semibold text-emerald-800 tabular-nums">
                            {formatPeso(Number(meal.price))}
                          </span>
                          <span>•</span>
                          <span>{meal.quantity_sold} orders sold</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddMeal(meal)}
                      className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                        addedMealId === meal.product_id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#2d6a4f] hover:bg-[#1b4d3e] text-white'
                      }`}
                    >
                      {addedMealId === meal.product_id ? (
                        <>
                          <Check size={13} /> Added!
                        </>
                      ) : (
                        <>
                          <Plus size={13} /> Add
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-right">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MostPopularMealWidget;

