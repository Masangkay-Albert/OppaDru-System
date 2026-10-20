<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PopularMealsController extends Controller
{
    public function getMostPopularThisMonth(Request $request)
    {
        $franchiseId = $request->query('franchise_id');
        $limit = min(50, max(1, (int) $request->query('limit', 10)));
        $cacheKey = 'popular_meals_' . ($franchiseId ?: 'all') . '_' . now()->format('Y_m') . '_lim_' . $limit;

        $data = Cache::remember($cacheKey, 300, function () use ($franchiseId, $limit) {
            return $this->computePopularMeals($franchiseId, $limit);
        });

        return response()->json($data);
    }

    private function computePopularMeals(?string $franchiseId, int $limit): array
    {
        $startOfMonth = now()->startOfMonth();
        $endOfMonth = now()->endOfMonth();

        // 1. Try querying order_items table via order relationship
        $orderQuery = Order::countedAsRevenue()
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth]);

        if ($franchiseId) {
            $orderQuery->where(function ($q) use ($franchiseId) {
                $q->where('branch_id', $franchiseId)
                    ->orWhere('franchise_id', $franchiseId);
            });
        }

        $totalRevenueOrders = (clone $orderQuery)->count();

        $itemAggregates = OrderItem::query()
            ->whereHas('order', function ($query) use ($startOfMonth, $endOfMonth, $franchiseId) {
                $query->countedAsRevenue()
                    ->whereBetween('created_at', [$startOfMonth, $endOfMonth]);
                if ($franchiseId) {
                    $query->where(function ($q) use ($franchiseId) {
                        $q->where('branch_id', $franchiseId)
                            ->orWhere('franchise_id', $franchiseId);
                    });
                }
            })
            ->select('product_id', 'product_name', DB::raw('SUM(quantity) as total_quantity'), DB::raw('SUM(quantity * product_price) as total_revenue'))
            ->groupBy('product_id', 'product_name')
            ->orderByDesc('total_quantity')
            ->limit($limit)
            ->get();

        // If order_items table had records
        $meals = [];
        $totalQuantityAll = 0;

        if ($itemAggregates->isNotEmpty()) {
            $totalQuantityAll = (int) OrderItem::query()
                ->whereHas('order', function ($query) use ($startOfMonth, $endOfMonth, $franchiseId) {
                    $query->countedAsRevenue()
                        ->whereBetween('created_at', [$startOfMonth, $endOfMonth]);
                    if ($franchiseId) {
                        $query->where(function ($q) use ($franchiseId) {
                            $q->where('branch_id', $franchiseId)
                                ->orWhere('franchise_id', $franchiseId);
                        });
                    }
                })
                ->sum('quantity');

            foreach ($itemAggregates as $row) {
                $meals[] = [
                    'product_id' => $row->product_id,
                    'name' => $row->product_name,
                    'quantity_sold' => (int) $row->total_quantity,
                    'revenue' => (float) $row->total_revenue,
                ];
            }
        } else {
            // Fallback: parse JSON items in orders table if order_items was empty
            $orders = (clone $orderQuery)->select('id', 'items')->get();
            $grouped = [];

            foreach ($orders as $order) {
                $items = is_array($order->items) ? $order->items : json_decode($order->items ?: '[]', true);
                if (!is_array($items)) continue;

                foreach ($items as $item) {
                    $pId = (string) ($item['product_id'] ?? $item['id'] ?? '');
                    $pName = (string) ($item['product_name'] ?? $item['name'] ?? 'Meal');
                    $qty = max(1, (int) ($item['quantity'] ?? 1));
                    $price = (float) ($item['product_price'] ?? $item['price'] ?? 0);

                    $key = $pId ?: $pName;
                    if (!isset($grouped[$key])) {
                        $grouped[$key] = [
                            'product_id' => $pId,
                            'name' => $pName,
                            'quantity_sold' => 0,
                            'revenue' => 0.0,
                        ];
                    }
                    $grouped[$key]['quantity_sold'] += $qty;
                    $grouped[$key]['revenue'] += ($price * $qty);
                    $totalQuantityAll += $qty;
                }
            }

            usort($grouped, fn ($a, $b) => $b['quantity_sold'] <=> $a['quantity_sold']);
            $meals = array_slice(array_values($grouped), 0, $limit);
        }

        // Attach Product details (image, category, price)
        $productIds = collect($meals)->pluck('product_id')->filter()->unique();
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');

        $baseUrl = (function_exists('request') && request()?->hasHeader('host'))
            ? rtrim(request()->root(), '/')
            : rtrim(config('app.url'), '/');

        $topQuantity = !empty($meals) ? (int) $meals[0]['quantity_sold'] : 0;
        $rankedList = [];

        foreach ($meals as $index => $meal) {
            $product = $products->get($meal['product_id']);
            $qty = (int) $meal['quantity_sold'];
            $relPercentage = $topQuantity > 0 ? round(($qty / $topQuantity) * 100, 1) : 0;
            $sharePercentage = $totalQuantityAll > 0 ? round(($qty / $totalQuantityAll) * 100, 1) : 0;

            $imageUrl = null;
            if ($product && !empty($product->image)) {
                if (str_starts_with($product->image, 'http://') || str_starts_with($product->image, 'https://') || str_starts_with($product->image, 'data:image')) {
                    $imageUrl = $product->image;
                } else {
                    $imageUrl = $baseUrl . '/storage/' . ltrim($product->image, '/');
                }
            }

            $rankedList[] = [
                'rank' => $index + 1,
                'product_id' => $meal['product_id'],
                'name' => $product ? $product->name : $meal['name'],
                'category' => $product ? $product->category : 'chicken',
                'price' => $product ? (float) $product->price : 0.0,
                'image' => $product ? $product->image : null,
                'image_url' => $imageUrl,
                'quantity_sold' => $qty,
                'revenue' => round($meal['revenue'], 2),
                'relative_percentage' => $relPercentage,
                'share_percentage' => $sharePercentage,
            ];
        }

        return [
            'month_name' => now()->format('F Y'),
            'start_date' => $startOfMonth->toDateString(),
            'end_date' => $endOfMonth->toDateString(),
            'total_orders' => $totalRevenueOrders,
            'total_quantity_sold' => $totalQuantityAll,
            'top_meals' => $rankedList,
        ];
    }
}

