<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

trait FranchiseDashboardActions
{
    public function dashboard(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branchId = (string) $user->franchise_id;
        $branchProducts = fn () => Product::where(function ($query) use ($branchId) {
            $query->where('franchise_id', $branchId)
                ->orWhereNull('franchise_id');
        });
        $branchOrders = fn () => Order::where('branch_id', $branchId);
        $salesOrders = fn () => Order::where('branch_id', $branchId)->countedAsRevenue();
        $inventory = app(FranchiseInventoryService::class)->catalog($branchId);
        $franchise = Franchise::findOrFail($branchId);
        $posOrders = fn () => $branchOrders()->where('delivery_type', 'onsite');

        return response()->json([
            'data' => [
                'franchise_id' => $branchId,
                'franchise_name' => $franchise->name,
                'branch_address' => $franchise->address,
                'branch_status' => $franchise->status,
                'products' => $branchProducts()->count(),
                'branch_products' => Product::where('franchise_id', $branchId)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'available_products' => $inventory->where('branch_available', true)->count(),
                'available_items' => $inventory->where('branch_available', true)->count(),
                'inventory_items' => $inventory->count(),
                'tracked_inventory_items' => $inventory->where('branch_stock_tracked', true)->count(),
                'orders' => $branchOrders()->count(),
                'total_orders' => $branchOrders()->count(),
                'branch_users' => FranchiseUser::where('franchise_id', $branchId)->count()
                    + Employee::where('franchise_id', $branchId)->count(),
                'total_revenue' => (float) $salesOrders()->sum('total'),
                'average_order_value' => (float) $salesOrders()->avg('total'),
                'pos_activity_count' => $posOrders()->count(),
                'pos_sales' => (float) $posOrders()->countedAsRevenue()->sum('total'),
                'pending_orders' => $branchOrders()->where('status', 'pending')->count(),
                'preparing_orders' => $branchOrders()->whereIn('status', ['confirmed', 'preparing'])->count(),
                'ready_orders' => $branchOrders()->whereIn('status', ['ready', 'prepared'])->count(),
                'completed_orders' => $branchOrders()->whereIn('status', ['delivered', 'completed'])->count(),
                'cancelled_orders' => $branchOrders()->where('status', 'cancelled')->count(),
                'orders_by_status' => $branchOrders()
                    ->selectRaw('status, COUNT(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status'),
                'recent_orders' => $branchOrders()
                    ->orderBy('created_at', 'desc')
                    ->limit(10)
                    ->with('user:id,full_name')
                    ->get([
                        'id',
                        'email',
                        'user_id',
                        'order_number',
                        'status',
                        'total',
                        'payment_method',
                        'delivery_type',
                        'delivery_address',
                        'created_at',
                    ]),
            ],
        ]);
    }

    public function products(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json([
            'data' => app(FranchiseInventoryService::class)->catalog((string) $user->franchise_id),
        ]);
    }

    public function orders(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->query(), [
            'status' => 'nullable|string|in:pending,confirmed,preparing,prepared,ready,delivered,completed,cancelled',
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'type' => 'nullable|in:online,onsite',
            'search' => 'nullable|string|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The order filters are invalid.', 'errors' => $validator->errors()], 422);
        }

        $query = Order::query()
            ->withoutProofImagePayload()
            ->where('branch_id', $user->franchise_id)
            ->with('user:id,full_name,email');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }
        if ($request->filled('type')) {
            if ($request->query('type') === 'onsite') {
                $query->where('delivery_type', 'onsite');
            } else {
                $query->where(fn ($builder) => $builder->whereNull('delivery_type')->orWhere('delivery_type', '!=', 'onsite'));
            }
        }
        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('order_number', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('delivery_address', 'like', '%'.$search.'%')
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where('full_name', 'like', '%'.$search.'%'));
            });
        }

        return response()->json([
            'data' => $query->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function showOrder(Request $request, string $id)
    {
        $user = $request->user();
        if (! $user || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $order = Order::where('branch_id', $user->franchise_id)->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found for this franchise'], 404);
        }

        return response()->json(['data' => $order->load(['user:id,full_name,email,phone', 'orderItems'])]);
    }

}
