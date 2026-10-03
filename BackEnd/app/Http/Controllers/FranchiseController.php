<?php

namespace App\Http\Controllers;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FranchiseController extends Controller
{
    use AdminAuthTrait;

    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => Franchise::orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function show(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);

        return response()->json(['data' => $franchise]);
    }

    public function stats(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $statusBreakdown = Franchise::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'data' => [
                'total_franchises' => Franchise::count(),
                'active_franchises' => Franchise::where('status', 'active')->count(),
                'pending_franchises' => Franchise::where('status', 'pending')->count(),
                'inactive_franchises' => Franchise::where('status', 'inactive')->count(),
                'total_franchise_users' => FranchiseUser::count(),
                'active_franchise_users' => FranchiseUser::where('is_active', true)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'branch_products' => Product::whereNotNull('franchise_id')->count(),
                'franchise_orders' => Order::whereNotNull('franchise_id')->count(),
                'status_breakdown' => $statusBreakdown,
            ],
        ]);
    }

    public function summary(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);
        $orders = Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_users' => $franchise->users()->count(),
                'active_users' => $franchise->users()->where('is_active', true)->count(),
                'total_products' => Product::where('franchise_id', $franchise->id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'total_orders' => $orders->count(),
                'total_revenue' => (float) $orders->sum('total'),
                'average_order_value' => (float) $orders->avg('total'),
                'status_breakdown' => $orders->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            ],
        ]);
    }

    public function branchSummary(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);
        $orders = Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_users' => $franchise->users()->count(),
                'active_users' => $franchise->users()->where('is_active', true)->count(),
                'total_products' => Product::where('franchise_id', $franchise->id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'total_orders' => $orders->count(),
                'total_revenue' => (float) $orders->sum('total'),
                'average_order_value' => (float) $orders->avg('total'),
                'status_breakdown' => $orders->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            ],
        ]);
    }

    public function inventorySummary(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $products = Product::where(function ($query) use ($user) {
            $query->where('franchise_id', $user->franchise_id)
                ->orWhereNull('franchise_id');
        });

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                'total_products' => $products->count(),
                'branch_products' => Product::where('franchise_id', $user->franchise_id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'available_products' => $products->where('is_available', true)->count(),
                'unavailable_products' => $products->where('is_available', false)->count(),
                'category_breakdown' => $products->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'recent_products' => $products->orderBy('created_at', 'desc')->limit(10)->get([
                    'id',
                    'name',
                    'category',
                    'price',
                    'franchise_id',
                    'is_available',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function fulfillmentSummary(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $orders = Order::where('franchise_id', $user->franchise_id);

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                'total_orders' => $orders->count(),
                'pending_orders' => $orders->where('status', 'pending')->count(),
                'preparing_orders' => $orders->where('status', 'preparing')->count(),
                'prepared_orders' => $orders->where('status', 'prepared')->count(),
                'ready_orders' => $orders->where('status', 'ready')->count(),
                'delivered_orders' => $orders->where('status', 'delivered')->count(),
                'cancelled_orders' => $orders->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $orders->avg('total'),
                'latest_orders' => $orders->orderBy('created_at', 'desc')->limit(10)->get([
                    'id',
                    'order_number',
                    'status',
                    'total',
                    'delivery_address',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function inventoryOverview(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $products = Product::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_products' => $products->count(),
                'available_products' => $products->where('is_available', true)->count(),
                'unavailable_products' => $products->where('is_available', false)->count(),
                'category_breakdown' => $products->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'recent_products' => $products->orderBy('created_at', 'desc')->limit(10)->get([
                    'id',
                    'name',
                    'category',
                    'price',
                    'is_available',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function fulfillmentOverview(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $orders = Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_orders' => $orders->count(),
                'pending_orders' => $orders->where('status', 'pending')->count(),
                'preparing_orders' => $orders->where('status', 'preparing')->count(),
                'prepared_orders' => $orders->where('status', 'prepared')->count(),
                'ready_orders' => $orders->where('status', 'ready')->count(),
                'delivered_orders' => $orders->where('status', 'delivered')->count(),
                'cancelled_orders' => $orders->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $orders->avg('total'),
                'latest_orders' => $orders->orderBy('created_at', 'desc')->limit(10)->get([
                    'id',
                    'order_number',
                    'status',
                    'total',
                    'delivery_address',
                    'created_at',
                ]),
            ],
        ]);
    }

    public function users(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::with(['users'])->findOrFail($id);

        return response()->json(['data' => $franchise->users()->orderBy('created_at', 'desc')->get()]);
    }

    public function storeUser(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:franchise_users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'nullable|string|min:8',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = FranchiseUser::create([
            'franchise_id' => $franchise->id,
            'full_name' => $request->full_name,
            'email' => strtolower(trim((string) $request->email)),
            'phone' => $request->phone,
            'password' => Hash::make((string) $request->input('password', 'Franchise@123')),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json(['data' => $user->load('franchise')], 201);
    }

    public function updateUser(Request $request, string $id, string $userId)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $user = FranchiseUser::where('franchise_id', $franchise->id)->where('id', $userId)->firstOrFail();

        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:franchise_users,email,' . $user->id,
            'phone' => 'sometimes|nullable|string|max:50',
            'password' => 'sometimes|nullable|string|min:8',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->filled('full_name')) {
            $user->full_name = $request->full_name;
        }

        if ($request->filled('email')) {
            $user->email = strtolower(trim((string) $request->email));
        }

        if ($request->has('phone')) {
            $user->phone = $request->phone;
        }

        if ($request->filled('password')) {
            $user->password = Hash::make((string) $request->password);
        }

        if ($request->has('is_active')) {
            $user->is_active = $request->boolean('is_active');
        }

        $user->save();

        return response()->json(['data' => $user->load('franchise')]);
    }

    public function toggleUserStatus(Request $request, string $id, string $userId)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $user = FranchiseUser::where('franchise_id', $franchise->id)->where('id', $userId)->firstOrFail();

        $validator = Validator::make($request->all(), [
            'is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user->is_active = $request->boolean('is_active');
        $user->save();

        return response()->json([
            'data' => $user->load('franchise'),
            'message' => 'Franchise user status updated successfully.',
        ]);
    }

    public function store(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive,pending',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $franchise = Franchise::create([
            'name' => $request->name,
            'slug' => Str::slug($request->name),
            'email' => $request->email,
            'phone' => $request->phone,
            'address' => $request->address,
            'status' => $request->input('status', 'active'),
            'owner_admin_id' => null,
        ]);

        return response()->json(['data' => $franchise], 201);
    }

    public function update(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|string|email|max:255',
            'phone' => 'sometimes|nullable|string|max:50',
            'address' => 'sometimes|nullable|string',
            'status' => 'sometimes|string|in:active,inactive,pending',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $franchise->fill($request->only(['name', 'email', 'phone', 'address', 'status']));
        if ($request->filled('name')) {
            $franchise->slug = Str::slug($request->name);
        }
        $franchise->save();

        return response()->json(['data' => $franchise]);
    }

    public function destroy(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $franchise->delete();

        return response()->json(['message' => 'Franchise deleted successfully']);
    }

    public function dashboard(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branchId = $user->franchise_id;
        $branchProducts = Product::where(function ($query) use ($branchId) {
            $query->where('franchise_id', $branchId)
                ->orWhereNull('franchise_id');
        });

        $franchiseOrders = Order::where('franchise_id', $branchId);

        return response()->json([
            'data' => [
                'franchise_id' => $branchId,
                'franchise_name' => optional($user->franchise)->name,
                'products' => $branchProducts->count(),
                'branch_products' => Product::where('franchise_id', $branchId)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'orders' => $franchiseOrders->count(),
                'customers' => User::count(),
                'orders_by_status' => $franchiseOrders
                    ->selectRaw('status, COUNT(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status'),
                'recent_orders' => $franchiseOrders
                    ->orderBy('created_at', 'desc')
                    ->limit(10)
                    ->get([
                        'id',
                        'order_number',
                        'status',
                        'total',
                        'payment_method',
                        'created_at',
                    ]),
            ],
        ]);
    }

    public function products(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json([
            'data' => Product::where(function ($query) use ($user) {
                $query->where('franchise_id', $user->franchise_id)
                    ->orWhereNull('franchise_id');
            })->orderBy('name')->get(),
        ]);
    }

    public function orders(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $query = Order::where('franchise_id', $user->franchise_id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'data' => $query->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function showOrder(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $order = Order::where('franchise_id', $user->franchise_id)->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found for this franchise'], 404);
        }

        return response()->json(['data' => $order->load(['user:id,full_name,email,phone', 'orderItems'])]);
    }

    public function updateOrderStatus(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,preparing,prepared,ready,delivered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $order = Order::where('franchise_id', $user->franchise_id)->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found for this franchise'], 404);
        }

        if ($request->status === 'cancelled' && $order->status !== 'pending') {
            return response()->json(['message' => 'Only pending franchise orders can be cancelled.'], 422);
        }

        $order->status = $request->status;
        $order->save();

        return response()->json([
            'data' => $order,
            'message' => 'Franchise order status updated successfully.',
        ]);
    }
}
