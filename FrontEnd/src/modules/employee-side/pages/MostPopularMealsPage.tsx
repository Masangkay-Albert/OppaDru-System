import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiTrendingUp,
  FiAward,
  FiShoppingBag,
  FiRefreshCw,
  FiCalendar,
} from 'react-icons/fi';
import { FaCrown, FaMedal } from 'react-icons/fa';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import { formatPeso } from '../../../utils/formatters';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';

interface PopularMeal {
  rank: number;
  product_id: string;
  name: string;
  category: string;
  price: number;
  image?: string | null;
  image_url?: string | null;
  quantity_sold: number;
  revenue: number;
  relative_percentage: number;
  share_percentage: number;
}

interface PopularMealsResponse {
  month_name: string;
  start_date: string;
  end_date: string;
  total_orders: number;
  total_quantity_sold: number;
  top_meals: PopularMeal[];
}

const MostPopularMealsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PopularMealsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPopularMeals = useCallback(async (showSpin = false) => {
    if (showSpin) {
      setIsRefreshing(true);
      setError('');
    }

    try {
      const response = await fetchWithEmployeeAuth('/cashier/popular-meals?limit=10');

      if (!response.ok) {
        throw new Error('Could not load popular meals for this month.');
      }

      const json = await response.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load popular meals.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => fetchPopularMeals());
  }, [fetchPopularMeals]);

  const topMeals = data?.top_meals || [];
  const totalQuantity = data?.total_quantity_sold || 0;
  const totalOrders = data?.total_orders || 0;
  const monthName = data?.month_name || 'This Month';
  const top1Meal = topMeals[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarEmployee />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#e76f51]/20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/employee')}
              className="flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
              <span className="text-sm font-medium">Back to Register</span>
            </button>
            <span className="text-gray-300 text-xl">|</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <FiTrendingUp size={16} />
              </div>
              <h1 className="text-xl font-bold text-[#2d6a4f]">Most Popular Meal This Month</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-xs">
              <FiCalendar className="text-[var(--oppa-green)]" size={13} />
              <span>{monthName}</span>
            </span>

            <button
              type="button"
              onClick={() => fetchPopularMeals(true)}
              disabled={isRefreshing}
              className="p-2 bg-white rounded-xl border border-gray-200 text-gray-600 hover:text-[var(--oppa-green)] hover:border-[var(--oppa-green)] transition shadow-xs disabled:opacity-50"
              title="Refresh Popular Dishes"
            >
              <FiRefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* High-level Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Month Revenue Orders</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{totalOrders.toLocaleString()}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Paid & completed sales</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--oppa-green)] flex items-center justify-center text-xl">
              <FiShoppingBag />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Meals Sold</p>
              <p className="text-2xl font-black text-[#2d6a4f] mt-1">{totalQuantity.toLocaleString()} items</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Across all menu items</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
              <FiTrendingUp />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">#1 Bestseller This Month</p>
              <p className="text-lg font-bold text-gray-900 mt-1 truncate max-w-[170px]" title={top1Meal?.name}>
                {top1Meal?.name || 'None yet'}
              </p>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                {top1Meal ? `${top1Meal.quantity_sold} sold (${top1Meal.share_percentage}% share)` : 'Waiting for orders'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
              <FaCrown />
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <FiRefreshCw className="animate-spin text-4xl text-[var(--oppa-green)] mx-auto mb-4" />
            <p className="text-gray-600 font-medium text-sm">Calculating rankings for {monthName}...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-red-100">
            <p className="text-red-600 font-semibold mb-3">{error}</p>
            <button
              onClick={() => fetchPopularMeals(false)}
              className="px-5 py-2 bg-[var(--oppa-green)] text-white text-xs font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : topMeals.length === 0 ? (
          /* Friendly Empty State */
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-3xl mx-auto mb-4">
              <FiAward />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Sales Recorded Yet This Month</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              We haven&apos;t recorded any paid or completed orders for <strong className="text-gray-700">{monthName}</strong>.
              As customers order meals at the counter or online, the top 10 rankings and sales bar charts will populate automatically.
            </p>
            <button
              onClick={() => navigate('/employee')}
              className="px-6 py-3 bg-[var(--oppa-green)] text-white rounded-xl font-bold text-sm hover:bg-[var(--oppa-green-dark)] transition shadow-md"
            >
              Start Taking Orders →
            </button>
          </div>
        ) : (
          /* Top 10 Ranked Meals List with Bar Charts */
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-base">Top 10 Menu Items ({monthName})</h2>
                <p className="text-xs text-gray-500">Ranked by total quantity sold across completed and revenue orders</p>
              </div>
              <span className="text-xs font-bold text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200">
                Top {topMeals.length} Dishes
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {topMeals.map((meal) => {
                const isTop1 = meal.rank === 1;
                const isTop2 = meal.rank === 2;
                const isTop3 = meal.rank === 3;

                return (
                  <div
                    key={meal.product_id || meal.rank}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-gray-50/60 ${
                      isTop1 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Rank & Image & Meal Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Rank Indicator */}
                      <div className="flex-shrink-0 w-10 text-center">
                        {isTop1 ? (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black shadow-md mx-auto">
                            <FaCrown size={15} />
                          </div>
                        ) : isTop2 ? (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white flex items-center justify-center font-bold text-sm shadow-xs mx-auto">
                            <FaMedal size={13} />
                          </div>
                        ) : isTop3 ? (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white flex items-center justify-center font-bold text-sm shadow-xs mx-auto">
                            <FaMedal size={13} />
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-gray-400 tabular-nums">
                            #{meal.rank}
                          </span>
                        )}
                      </div>

                      {/* Food Thumbnail */}
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 flex items-center justify-center relative">
                        {meal.image ? (
                          <img
                            src={meal.image.startsWith('http') || meal.image.startsWith('/') ? meal.image : `/${meal.image}`}
                            alt={meal.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <FiShoppingBag className="text-gray-300 text-xl" />
                        )}
                        {isTop1 && (
                          <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-white text-[9px] font-black uppercase tracking-tighter text-center py-0.2">
                            #1 BEST
                          </span>
                        )}
                      </div>

                      {/* Title & Category */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                            {meal.name}
                          </h3>
                          {meal.category && (
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase">
                              {meal.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Menu price: <strong className="text-gray-700">{formatPeso(meal.price)}</strong>
                          {meal.revenue > 0 && (
                            <span className="ml-2 text-gray-400">
                              · Total revenue: <strong className="text-emerald-700">{formatPeso(meal.revenue)}</strong>
                            </span>
                          )}
                        </p>

                        {/* Relative Popularity Bar Chart */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 max-w-xs h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isTop1
                                  ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                                  : isTop2
                                  ? 'bg-gradient-to-r from-slate-400 to-slate-600'
                                  : isTop3
                                  ? 'bg-gradient-to-r from-amber-600 to-amber-800'
                                  : 'bg-[var(--oppa-green)]'
                              }`}
                              style={{ width: `${Math.max(5, meal.relative_percentage)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                            {meal.share_percentage}% of sales
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sales Metrics Counter */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-14 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-0 border-gray-100">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block">Sold</span>
                        <span className="text-lg sm:text-xl font-black text-gray-900 tabular-nums">
                          {meal.quantity_sold.toLocaleString()} <span className="text-xs font-semibold text-gray-500">orders</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MostPopularMealsPage;
