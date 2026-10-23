<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Employee;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Services\FranchiseInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

trait FranchisePosReadActions
{
    public function employeePosProducts(Request $request)
    {
        $user = $request->user();
        if (
            ! $user instanceof Employee
            || ! $user->franchise_id
            || strtolower((string) $user->position) !== 'cashier'
        ) {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        return response()->json([
            'data' => app(FranchiseInventoryService::class)->catalog((string) $user->franchise_id, true),
        ]);
    }

    public function employeePosOrders(Request $request)
    {
        $user = $request->user();
        if (
            ! $user instanceof Employee
            || ! $user->franchise_id
            || strtolower((string) $user->position) !== 'cashier'
        ) {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        $orders = Order::where('branch_id', $user->franchise_id)
                ->where('cashier_employee_id', $user->id)
                ->where('delivery_type', 'onsite')
                ->with('branch:id,name')
                ->orderByDesc('created_at')
                ->limit(100)
                ->get([
                    'id',
                    'order_number',
                    'branch_id',
                    'total',
                    'payment_method',
                    'payment_status',
                    'payment_reference',
                    'status',
                    'created_at',
                ]);
        $orders->each(fn (Order $order) => $order->setAttribute('branch_name', $order->branch?->name));

        return response()->json(['data' => $orders]);
    }

    public function employeePosTopProducts(Request $request)
    {
        $user = $request->user();
        if (
            ! $user instanceof Employee
            || ! $user->franchise_id
            || strtolower((string) $user->position) !== 'cashier'
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Branch cashier access required.',
            ], 403);
        }

        $validator = Validator::make($request->query(), [
            'period' => 'nullable|string|in:month',
            'limit' => 'nullable|integer|min:1|max:20',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'The top products filters are invalid.',
                'errors' => $validator->errors(),
            ], 400);
        }

        $period = $request->query('period', 'month');
        $limit = (int) $request->query('limit', 5);
        $month = now('Asia/Manila')->format('Y_m');
        $cacheKey = "employee_pos_top_products_{$user->franchise_id}_{$period}_{$limit}_{$month}";

        $products = Cache::remember($cacheKey, now()->addSeconds(60), function () use ($user, $limit) {
            $monthStart = now('Asia/Manila')->startOfMonth()->utc();
            $monthEnd = now('Asia/Manila')->endOfMonth()->utc();

            return DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
                ->where(function ($query) use ($user) {
                    $query->where('orders.branch_id', $user->franchise_id)
                        ->orWhere(function ($legacyQuery) use ($user) {
                            $legacyQuery->whereNull('orders.branch_id')
                                ->where('orders.franchise_id', $user->franchise_id);
                        });
                })
                ->whereBetween('orders.created_at', [$monthStart, $monthEnd])
                ->where('orders.payment_status', 'paid')
                ->whereNotIn('orders.status', ['cancelled', 'voided', 'failed'])
                ->select([
                    'order_items.product_id',
                    'products.name',
                    'products.image',
                    'products.category',
                    'products.price',
                ])
                ->selectRaw('COALESCE(products.name, order_items.product_name) as product_display_name')
                ->selectRaw('SUM(order_items.quantity) as qty_sold')
                ->selectRaw('SUM(order_items.quantity * order_items.product_price) as revenue')
                ->groupBy(
                    'order_items.product_id',
                    'order_items.product_name',
                    'products.name',
                    'products.image',
                    'products.category',
                    'products.price'
                )
                ->orderByDesc('qty_sold')
                ->limit($limit)
                ->get()
                ->values()
                ->map(fn ($item, int $index) => [
                    'productId' => $item->product_id,
                    'name' => $item->product_display_name,
                    'image' => $item->image,
                    'category' => $item->category,
                    'price' => (float) ($item->price ?? 0),
                    'qtySold' => (int) $item->qty_sold,
                    'revenue' => round((float) $item->revenue, 2),
                    'rank' => $index + 1,
                ])
                ->all();
        });

        return response()->json($products);
    }

    public function franchisePosOrders(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise manager access required.'], 403);
        }

        $validator = Validator::make($request->query(), [
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'payment_method' => 'nullable|string|in:cash,gcash,credit_card',
            'cashier_id' => 'nullable|string|exists:employees,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'The POS activity filters are invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $query = Order::where('branch_id', $user->franchise_id)
            ->where('delivery_type', 'onsite')
            ->with([
                'franchise.franchiseAccount:id,name',
                'branch:id,name',
                'cashier:id,fullName,email',
                'franchiseOperator:id,full_name,email',
                'payment:id,order_id,reference,status,paid_at',
            ]);
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }
        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->query('payment_method'));
        }
        if ($request->filled('cashier_id')) {
            $query->where('cashier_employee_id', $request->query('cashier_id'));
        }

        $salesQuery = (clone $query)->countedAsRevenue();
        $salesCount = (clone $salesQuery)->count();
        $salesTotal = (float) (clone $salesQuery)->sum('total');
        $averageSale = (float) (clone $salesQuery)->avg('total');
        $orders = $query
            ->orderByDesc('created_at')
            ->paginate((int) $request->query('per_page', 50));
        $rows = $orders->getCollection();

        return response()->json([
            'data' => $rows->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'franchise_id' => $order->franchise_id,
                'branch_name' => $order->branch?->name ?? $order->franchise?->name,
                'franchise' => $order->franchise?->franchiseAccount ? [
                    'id' => $order->franchise->franchiseAccount->id,
                    'name' => $order->franchise->franchiseAccount->name,
                ] : null,
                'location' => [
                    'id' => $order->franchise_id,
                    'name' => $order->franchise?->name,
                ],
                'location_name' => $order->franchise?->name,
                'cashier_employee_id' => $order->cashier_employee_id,
                'franchise_user_id' => $order->franchise_user_id,
                'operator_email' => $order->email,
                'cashier' => $order->cashier ? [
                    'id' => $order->cashier->id,
                    'name' => $order->cashier->fullName,
                    'email' => $order->cashier->email,
                ] : null,
                'franchise_operator' => $order->franchiseOperator ? [
                    'id' => $order->franchiseOperator->id,
                    'name' => $order->franchiseOperator->full_name,
                    'email' => $order->franchiseOperator->email,
                ] : null,
                'total' => (float) $order->total,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'payment_reference' => $order->payment_reference,
                'gateway_payment' => $order->payment ? [
                    'reference' => $order->payment->reference,
                    'status' => $order->payment->status,
                    'paid_at' => $order->payment->paid_at,
                ] : null,
                'status' => $order->status,
                'created_at' => $order->created_at,
            ]),
            'summary' => [
                'transaction_count' => $orders->total(),
                'sales_count' => $salesCount,
                'total_sales' => $salesTotal,
                'average_transaction_value' => $averageSale,
            ],
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
            ],
        ]);
    }
}
