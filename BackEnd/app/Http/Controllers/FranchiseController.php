<?php

namespace App\Http\Controllers;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Employee;
use App\Models\Addon;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Services\FranchiseInventoryService;
use App\Services\Order\OrderDataService;
use App\Services\PricingService;
use App\Services\Payment\PaymentHelperService;

class FranchiseController extends Controller
{
    use AdminAuthTrait;

    public function activeBranches()
    {
        return response()->json([
            'data' => Franchise::where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'address']),
        ]);
    }

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
        $orders = fn () => Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_users' => $franchise->users()->count(),
                'active_users' => $franchise->users()->where('is_active', true)->count(),
                'total_products' => Product::where('franchise_id', $franchise->id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'total_orders' => $orders()->count(),
                'total_revenue' => (float) $orders()->whereNotIn('status', ['cancelled'])->sum('total'),
                'average_order_value' => (float) $orders()->whereNotIn('status', ['cancelled'])->avg('total'),
                'status_breakdown' => $orders()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
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
        $orders = fn () => Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_users' => $franchise->users()->count(),
                'active_users' => $franchise->users()->where('is_active', true)->count(),
                'total_products' => Product::where('franchise_id', $franchise->id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'total_orders' => $orders()->count(),
                'total_revenue' => (float) $orders()->whereNotIn('status', ['cancelled'])->sum('total'),
                'average_order_value' => (float) $orders()->whereNotIn('status', ['cancelled'])->avg('total'),
                'status_breakdown' => $orders()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            ],
        ]);
    }

    public function storePosOrder(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:99',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|integer|exists:addons,id',
            'items.*.selected_addons.*.quantity' => 'nullable|integer|min:1|max:20',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'customer_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'dining_option' => 'required|string|in:dine_in,takeout',
            'payment_method' => 'required|string|in:cash,gcash',
            'payment_reference' => 'required_if:payment_method,gcash|nullable|string|max:100',
            'cash_tendered' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'discount_id_number' => 'required_with:discount_type|nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Please check the POS order details.', 'errors' => $validator->errors()], 422);
        }

        $productIds = collect($request->input('items'))->pluck('product_id')->unique();
        $products = Product::whereIn('id', $productIds)
            ->where('is_available', true)
            ->where(function ($query) use ($user) {
                $query->whereNull('franchise_id')->orWhere('franchise_id', $user->franchise_id);
            })
            ->get()
            ->keyBy('id');

        if ($products->count() !== $productIds->count()) {
            return response()->json(['message' => 'One or more items are unavailable at this branch.'], 422);
        }

        $items = collect($request->input('items'))->map(function (array $item) use ($products) {
            $product = $products->get($item['product_id']);
            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => (float) $product->price,
                'quantity' => (int) $item['quantity'],
                'selected_addons' => $item['selected_addons'] ?? [],
                'selected_size' => $item['selected_size'] ?? null,
                'special_instructions' => $item['special_instructions'] ?? null,
            ];
        })->values()->all();

        $addonIds = collect($items)
            ->flatMap(fn (array $item) => collect($item['selected_addons'])->pluck('id'))
            ->unique()
            ->values();
        $addons = Addon::with('group')->whereIn('id', $addonIds)->get()->keyBy('id');
        if ($addonIds->isNotEmpty() && ($addons->count() !== $addonIds->count()
            || $addons->contains(fn (Addon $addon) => !$addon->group
                || ($addon->group->franchise_id !== null && (string) $addon->group->franchise_id !== (string) $user->franchise_id)))) {
            return response()->json(['message' => 'One or more add-ons are not available at this branch.'], 422);
        }
        foreach ($items as $item) {
            $groups = collect($item['selected_addons'])->groupBy(fn (array $selection) => $addons->get($selection['id'])?->addon_group_id);
            foreach ($groups as $groupId => $selections) {
                $group = $addons->get($selections->first()['id'])?->group;
                if (!$group || ($group->selection_type === 'single' && $selections->count() > 1)
                    || ($group->max_selections !== null && $selections->count() > $group->max_selections)
                    || (!$group->supports_quantity && $selections->contains(fn (array $selection) => (int) ($selection['quantity'] ?? 1) > 1))) {
                    return response()->json(['message' => 'The selected add-ons exceed the allowed choices for this product.'], 422);
                }
            }
        }

        $inventoryService = app(FranchiseInventoryService::class);
        $availableProductIds = $inventoryService->catalog((string) $user->franchise_id, true)->pluck('id')->all();
        if ($productIds->diff($availableProductIds)->isNotEmpty()) {
            return response()->json(['message' => 'One or more items are unavailable at this branch.'], 422);
        }

        foreach ($items as $index => $item) {
            $product = $products->get($item['product_id']);
            if (in_array(strtolower($product->category), ['fruity-soda-milk', 'fresh-lemonade'], true)
                && empty($item['selected_size'])) {
                return response()->json(['message' => 'Select a size for each drink before placing the order.'], 422);
            }
        }

        try {
            $pricing = app(PricingService::class)->calculate($items);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $sizeAdjustments = collect($items)->sum(function (array $item) use ($products) {
            $product = $products->get($item['product_id']);
            if (!in_array(strtolower($product->category), ['fruity-soda-milk', 'fresh-lemonade'], true)) {
                return 0;
            }

            return match ($item['selected_size']) {
                'Small' => -10 * $item['quantity'],
                'Large' => 20 * $item['quantity'],
                default => 0,
            };
        });
        $subtotal = max(0, round($pricing['subtotal'] + $sizeAdjustments, 2));
        foreach ($items as $index => $item) {
            $basePrice = (float) $products->get($item['product_id'])->price;
            $sizeAdjustment = match ($item['selected_size']) {
                'Small' => -10,
                'Large' => 20,
                default => 0,
            };
            $items[$index]['product_price'] = max(0, $basePrice + $sizeAdjustment);
        }
        $discountType = $request->input('discount_type');
        $discountRate = $discountType ? 0.20 : 0;
        $discountAmount = round($subtotal * $discountRate, 2);
        $total = max(0, $subtotal - $discountAmount);
        $paymentMethod = $request->input('payment_method');
        $cashTendered = (float) $request->input('cash_tendered', 0);

        if ($paymentMethod === 'cash' && $cashTendered < $total) {
            return response()->json(['message' => 'Cash tendered must cover the order total.'], 422);
        }
        $gatewayPayment = null;
        if ($paymentMethod !== 'cash') {
            $gatewayPayment = Payment::where('reference', $request->input('payment_reference'))
                ->where('status', 'paid')
                ->whereNull('order_id')
                ->first();
            if (!$gatewayPayment
                || data_get($gatewayPayment->metadata, 'purpose') !== 'franchise_pos'
                || (string) data_get($gatewayPayment->metadata, 'franchise_id') !== (string) $user->franchise_id
                || round((float) $gatewayPayment->amount, 2) !== round($total, 2)) {
                return response()->json(['message' => 'Payment must be confirmed by the payment gateway for the exact POS total before completing this order.'], 422);
            }
        }

        $diningLabel = $request->input('dining_option') === 'dine_in' ? 'Dine In' : 'Takeout';
        $customerName = trim((string) $request->input('customer_name', 'Walk-in Customer')) ?: 'Walk-in Customer';
        $deliveryAddress = "Onsite - {$diningLabel} (Customer: {$customerName})";
        if ($request->filled('notes')) {
            $deliveryAddress .= ' | Notes: ' . trim((string) $request->input('notes'));
        }

        $orderDataService = app(OrderDataService::class);
        $orderItems = collect($orderDataService->buildOrderItems($items))
            ->map(function (array $orderItem, int $index) use ($items) {
                $orderItem['product_price'] = $items[$index]['product_price'];
                return $orderItem;
            })
            ->all();
        try {
            $order = DB::transaction(function () use (
                $inventoryService,
                $user,
                $items,
                $orderDataService,
                $orderItems,
                $total,
                $deliveryAddress,
                $paymentMethod,
                $request,
                $discountType,
                $discountRate,
                $discountAmount,
                $gatewayPayment
            ) {
                $inventoryService->consume((string) $user->franchise_id, $items);
                if ($gatewayPayment) {
                    $gatewayPayment = Payment::whereKey($gatewayPayment->id)->lockForUpdate()->first();
                    if (!$gatewayPayment || $gatewayPayment->status !== 'paid' || $gatewayPayment->order_id !== null
                        || data_get($gatewayPayment->metadata, 'purpose') !== 'franchise_pos'
                        || (string) data_get($gatewayPayment->metadata, 'franchise_id') !== (string) $user->franchise_id
                        || round((float) $gatewayPayment->amount, 2) !== round($total, 2)) {
                        throw new \InvalidArgumentException('This payment is no longer available for this order.');
                    }
                }
                $order = Order::create([
                    'franchise_id' => $user->franchise_id,
                    'email' => $user->email,
                    'total' => $total,
                    'delivery_type' => 'onsite',
                    'delivery_address' => $deliveryAddress,
                    'delivery_fee' => 0,
                    'delivery_distance_km' => 0,
                    'delivery_calculation_method' => 'onsite',
                    'service_fee' => 0,
                    'priority_fee' => 0,
                    'status' => 'pending',
                    'payment_method' => $paymentMethod,
                    'payment_status' => 'paid',
                    'payment_reference' => $paymentMethod === 'cash'
                        ? 'CASH-' . strtoupper(Str::random(8))
                        : $gatewayPayment->reference,
                    'phone' => $request->input('phone', ''),
                    'items' => $orderItems,
                    'vat' => round($total * 0.12, 2),
                    'discount_type' => $discountType,
                    'discount_rate' => $discountType ? $discountRate : null,
                    'discount_amount' => $discountType ? $discountAmount : null,
                    'discount_status' => $discountType ? 'approved' : 'not_requested',
                    'discount_proof_image' => $discountType ? 'Verified ID: ' . $request->input('discount_id_number') : null,
                    'discount_requested_at' => $discountType ? now() : null,
                    'discount_reviewed_at' => $discountType ? now() : null,
                ]);
                $orderDataService->syncOrderItems($order, $orderItems);
                if ($gatewayPayment) {
                    $gatewayPayment->update(['order_id' => $order->id]);
                }

                return $order;
            });
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'order' => $order->refresh(),
            'subtotal' => round($subtotal, 2),
            'discount_amount' => $discountAmount,
            'change_due' => $paymentMethod === 'cash' ? round($cashTendered - $total, 2) : 0,
            'message' => 'Franchise POS order placed successfully.',
        ], 201);
    }

    public function createPosPayment(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:99',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|integer|exists:addons,id',
            'items.*.selected_addons.*.quantity' => 'nullable|integer|min:1|max:20',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'discount_id_number' => 'required_with:discount_type|nullable|string|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Please check the POS payment details.', 'errors' => $validator->errors()], 422);
        }

        $productIds = collect($request->input('items'))->pluck('product_id')->unique();
        $products = Product::whereIn('id', $productIds)
            ->where('is_available', true)
            ->where(fn ($query) => $query->whereNull('franchise_id')->orWhere('franchise_id', $user->franchise_id))
            ->get()
            ->keyBy('id');
        if ($products->count() !== $productIds->count()) {
            return response()->json(['message' => 'One or more items are unavailable at this branch.'], 422);
        }

        $items = collect($request->input('items'))->map(fn (array $item) => [
            'product_id' => $item['product_id'],
            'quantity' => (int) $item['quantity'],
            'selected_addons' => $item['selected_addons'] ?? [],
            'selected_size' => $item['selected_size'] ?? null,
        ])->values()->all();
        $availableIds = app(FranchiseInventoryService::class)
            ->catalog((string) $user->franchise_id, true)
            ->pluck('id');
        if ($productIds->diff($availableIds)->isNotEmpty()) {
            return response()->json(['message' => 'One or more items are unavailable at this branch.'], 422);
        }

        $addonIds = collect($items)->flatMap(fn (array $item) => collect($item['selected_addons'])->pluck('id'))->unique();
        $addons = Addon::with('group')->whereIn('id', $addonIds)->get()->keyBy('id');
        if ($addons->count() !== $addonIds->count()
            || $addons->contains(fn (Addon $addon) => !$addon->group || !$addon->group->is_active
                || ($addon->group->franchise_id !== null && (string) $addon->group->franchise_id !== (string) $user->franchise_id))) {
            return response()->json(['message' => 'One or more add-ons are not available at this branch.'], 422);
        }
        foreach ($items as $item) {
            foreach (collect($item['selected_addons'])->groupBy(fn (array $selection) => $addons->get($selection['id'])?->addon_group_id) as $selections) {
                $group = $addons->get($selections->first()['id'])?->group;
                if (!$group || ($group->selection_type === 'single' && $selections->count() > 1)
                    || ($group->max_selections !== null && $selections->count() > $group->max_selections)
                    || (!$group->supports_quantity && $selections->contains(fn (array $selection) => (int) ($selection['quantity'] ?? 1) > 1))) {
                    return response()->json(['message' => 'The selected add-ons exceed the allowed choices for this product.'], 422);
                }
            }
            if (in_array(strtolower($products->get($item['product_id'])->category), ['fruity-soda-milk', 'fresh-lemonade'], true)
                && empty($item['selected_size'])) {
                return response()->json(['message' => 'Select a size for each drink before paying.'], 422);
            }
        }

        try {
            $pricing = app(PricingService::class)->calculate($items);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $sizeAdjustment = collect($items)->sum(function (array $item) use ($products) {
            if (!in_array(strtolower($products->get($item['product_id'])->category), ['fruity-soda-milk', 'fresh-lemonade'], true)) {
                return 0;
            }

            return match ($item['selected_size']) {
                'Small' => -10 * $item['quantity'],
                'Large' => 20 * $item['quantity'],
                default => 0,
            };
        });
        $subtotal = max(0, round($pricing['subtotal'] + $sizeAdjustment, 2));
        $discountAmount = $request->filled('discount_type') ? round($subtotal * 0.20, 2) : 0;
        $amount = max(0, round($subtotal - $discountAmount, 2));

        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey) {
            return response()->json(['message' => 'Gateway-backed GCash payments are not configured for this environment.'], 503);
        }

        $reference = app(PaymentHelperService::class)->generateReferenceNumber();
        $gatewayResponse = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->post(config('services.paymongo.base_url') . '/sources', [
                'data' => ['attributes' => [
                    'amount' => (int) round($amount * 100),
                    'currency' => 'PHP',
                    'type' => 'gcash',
                    'redirect' => [
                        'success' => rtrim(config('app.frontend_url'), '/') . '/franchise/pos?payment_reference=' . $reference,
                        'failed' => rtrim(config('app.frontend_url'), '/') . '/franchise/pos?payment_reference=' . $reference,
                    ],
                ]],
            ]);
        if ($gatewayResponse->failed()) {
            return response()->json(['message' => 'Unable to start gateway GCash payment.'], 502);
        }

        $source = $gatewayResponse->json('data');
        $attributes = $source['attributes'] ?? [];
        $payment = Payment::create([
            'reference' => $reference,
            'provider' => 'paymongo',
            'provider_id' => $source['id'],
            'amount' => $amount,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
            'metadata' => [
                'purpose' => 'franchise_pos',
                'franchise_id' => (string) $user->franchise_id,
                'source_status' => $attributes['status'] ?? 'pending',
                'checkout_url' => $attributes['redirect']['checkout_url'] ?? null,
            ],
        ]);

        return response()->json([
            'data' => [
                'reference' => $payment->reference,
                'checkout_url' => data_get($payment->metadata, 'checkout_url'),
                'amount' => (float) $payment->amount,
                'expires_at' => $payment->expires_at?->toISOString(),
            ],
        ], 201);
    }

    public function inventorySummary(Request $request, FranchiseInventoryService $inventoryService)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branchProducts = function () use ($user) {
            return Product::where(function ($query) use ($user) {
                $query->where('franchise_id', $user->franchise_id)
                    ->orWhereNull('franchise_id');
            });
        };

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                'total_products' => $branchProducts()->count(),
                'branch_products' => Product::where('franchise_id', $user->franchise_id)->count(),
                'shared_products' => Product::whereNull('franchise_id')->count(),
                'available_products' => $branchProducts()->where('is_available', true)->count(),
                'unavailable_products' => $branchProducts()->where('is_available', false)->count(),
                'category_breakdown' => $branchProducts()->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'items' => $inventoryService->catalog((string) $user->franchise_id),
                'recent_products' => $branchProducts()->orderBy('created_at', 'desc')->limit(10)->get([
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
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $branchOrders = fn () => Order::where('franchise_id', $user->franchise_id);

        return response()->json([
            'data' => [
                'franchise_id' => $user->franchise_id,
                'total_orders' => $branchOrders()->count(),
                'pending_orders' => $branchOrders()->where('status', 'pending')->count(),
                'preparing_orders' => $branchOrders()->whereIn('status', ['confirmed', 'preparing'])->count(),
                'prepared_orders' => $branchOrders()->where('status', 'prepared')->count(),
                'ready_orders' => $branchOrders()->where('status', 'ready')->count(),
                'delivered_orders' => $branchOrders()->whereIn('status', ['delivered', 'completed'])->count(),
                'cancelled_orders' => $branchOrders()->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $branchOrders()->whereNotIn('status', ['cancelled'])->avg('total'),
                'latest_orders' => $branchOrders()->orderByDesc('created_at')->limit(10)->get([
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

    public function branchUsers(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $managerUsers = FranchiseUser::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'full_name', 'email', 'phone', 'is_active', 'created_at'])
            ->map(fn (FranchiseUser $branchUser) => [
                'id' => $branchUser->id,
                'name' => $branchUser->full_name,
                'email' => $branchUser->email,
                'phone' => $branchUser->phone,
                'role' => 'Franchise Manager',
                'status' => $branchUser->is_active ? 'active' : 'inactive',
                'created_at' => $branchUser->created_at,
            ]);
        $employees = Employee::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'fullName', 'email', 'position', 'created_at'])
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'phone' => null,
                'role' => ucfirst($employee->position),
                'status' => 'active',
                'created_at' => $employee->created_at,
            ]);

        return response()->json(['data' => $managerUsers->concat($employees)->sortByDesc('created_at')->values()]);
    }

    public function storeBranchUser(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:franchise_users,email',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $branchUser = FranchiseUser::create([
            'franchise_id' => $user->franchise_id,
            'full_name' => $request->full_name,
            'email' => strtolower(trim((string) $request->email)),
            'phone' => $request->input('phone'),
            'password' => Hash::make((string) $request->password),
            'is_active' => true,
        ]);

        return response()->json([
            'data' => $branchUser->only(['id', 'franchise_id', 'full_name', 'email', 'phone', 'is_active', 'created_at']),
            'message' => 'Branch manager account created successfully.',
        ], 201);
    }

    public function branchSettings(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);
        return response()->json([
            'data' => [
                'id' => $franchise->id,
                'name' => $franchise->name,
                'email' => $franchise->email,
                'phone' => $franchise->phone,
                'address' => $franchise->address,
                'status' => $franchise->status,
                'operating_hours' => data_get($franchise->metadata, 'operating_hours'),
            ],
        ]);
    }

    public function updateBranchSettings(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'phone' => 'sometimes|nullable|string|max:50',
            'operating_hours' => 'sometimes|nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $franchise = Franchise::findOrFail($user->franchise_id);
        if ($request->has('phone')) {
            $franchise->phone = $request->input('phone');
        }
        if ($request->has('operating_hours')) {
            $metadata = $franchise->metadata ?? [];
            $metadata['operating_hours'] = $request->input('operating_hours');
            $franchise->metadata = $metadata;
        }
        $franchise->save();

        return response()->json([
            'data' => [
                'id' => $franchise->id,
                'name' => $franchise->name,
                'email' => $franchise->email,
                'phone' => $franchise->phone,
                'address' => $franchise->address,
                'status' => $franchise->status,
                'operating_hours' => data_get($franchise->metadata, 'operating_hours'),
            ],
            'message' => 'Branch settings updated successfully.',
        ]);
    }

    public function updateInventory(Request $request, string $productId, FranchiseInventoryService $inventoryService)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'stock_quantity' => 'sometimes|nullable|integer|min:0',
            'is_available' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Inventory details are invalid.', 'errors' => $validator->errors()], 422);
        }
        if (!$request->has('stock_quantity') && !$request->has('is_available')) {
            return response()->json(['message' => 'Provide branch stock or availability to update.'], 422);
        }

        $inventory = $inventoryService->update(
            (string) $user->franchise_id,
            $productId,
            $request->only(['stock_quantity', 'is_available'])
        );

        return response()->json(['data' => $inventory, 'message' => 'Branch inventory updated.']);
    }

    public function branchReports(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->query(), [
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'The report date range is invalid.', 'errors' => $validator->errors()], 422);
        }

        $query = Order::where('franchise_id', $user->franchise_id);
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        $orders = $query->with('orderItems')->orderByDesc('created_at')->get();
        $completedOrders = $orders->whereIn('status', ['delivered', 'completed']);
        $salesOrders = $orders->whereNotIn('status', ['cancelled']);
        $productSales = [];
        foreach ($salesOrders as $order) {
            foreach (($order->items ?? []) as $item) {
                $key = (string) ($item['product_id'] ?? $item['product_name'] ?? 'unknown');
                if (!isset($productSales[$key])) {
                    $productSales[$key] = [
                        'product_id' => $item['product_id'] ?? null,
                        'product_name' => $item['product_name'] ?? 'Item',
                        'quantity' => 0,
                        'sales' => 0.0,
                    ];
                }
                $quantity = (int) ($item['quantity'] ?? 0);
                $productSales[$key]['quantity'] += $quantity;
                $productSales[$key]['sales'] += (float) ($item['product_price'] ?? 0) * $quantity;
            }
        }

        return response()->json([
            'data' => [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'total_sales' => (float) $salesOrders->sum('total'),
                'total_orders' => $orders->count(),
                'completed_orders' => $completedOrders->count(),
                'cancelled_orders' => $orders->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $salesOrders->avg('total'),
                'product_sales' => collect(array_values($productSales))->sortByDesc('sales')->values(),
                'payment_summary' => $salesOrders->groupBy('payment_method')->map(fn ($group) => [
                    'orders' => $group->count(),
                    'amount' => (float) $group->sum('total'),
                ]),
                'discount_summary' => [
                    'discounted_orders' => $salesOrders->whereNotNull('discount_type')->count(),
                    'discount_amount' => (float) $salesOrders->sum('discount_amount'),
                ],
            ],
        ]);
    }

    public function inventoryOverview(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $franchise = Franchise::findOrFail($id);
        $branchProducts = fn () => Product::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_products' => $branchProducts()->count(),
                'available_products' => $branchProducts()->where('is_available', true)->count(),
                'unavailable_products' => $branchProducts()->where('is_available', false)->count(),
                'category_breakdown' => $branchProducts()->selectRaw('category, COUNT(*) as total')->groupBy('category')->pluck('total', 'category'),
                'recent_products' => $branchProducts()->orderByDesc('created_at')->limit(10)->get([
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
        $orders = fn () => Order::where('franchise_id', $franchise->id);

        return response()->json([
            'data' => [
                'franchise_id' => $franchise->id,
                'franchise_name' => $franchise->name,
                'total_orders' => $orders()->count(),
                'pending_orders' => $orders()->where('status', 'pending')->count(),
                'preparing_orders' => $orders()->whereIn('status', ['confirmed', 'preparing'])->count(),
                'prepared_orders' => $orders()->where('status', 'prepared')->count(),
                'ready_orders' => $orders()->where('status', 'ready')->count(),
                'delivered_orders' => $orders()->whereIn('status', ['delivered', 'completed'])->count(),
                'cancelled_orders' => $orders()->where('status', 'cancelled')->count(),
                'average_order_value' => (float) $orders()->whereNotIn('status', ['cancelled'])->avg('total'),
                'latest_orders' => $orders()->orderBy('created_at', 'desc')->limit(10)->get([
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

        $branchId = (string) $user->franchise_id;
        $branchProducts = fn () => Product::where(function ($query) use ($branchId) {
            $query->where('franchise_id', $branchId)
                ->orWhereNull('franchise_id');
        });
        $branchOrders = fn () => Order::where('franchise_id', $branchId);
        $salesOrders = fn () => Order::where('franchise_id', $branchId)->whereNotIn('status', ['cancelled']);
        $inventory = app(FranchiseInventoryService::class)->catalog($branchId);
        $franchise = Franchise::findOrFail($branchId);

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
                'orders' => $branchOrders()->count(),
                'total_orders' => $branchOrders()->count(),
                'branch_users' => FranchiseUser::where('franchise_id', $branchId)->count()
                    + Employee::where('franchise_id', $branchId)->count(),
                'total_revenue' => (float) $salesOrders()->sum('total'),
                'average_order_value' => (float) $salesOrders()->avg('total'),
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
        if (!$user || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json([
            'data' => app(FranchiseInventoryService::class)->catalog((string) $user->franchise_id),
        ]);
    }

    public function orders(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->franchise_id) {
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

        $query = Order::where('franchise_id', $user->franchise_id)->with('user:id,full_name,email');

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
                $builder->where('order_number', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('delivery_address', 'like', '%' . $search . '%')
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where('full_name', 'like', '%' . $search . '%'));
            });
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
            'status' => 'required|string|in:pending,confirmed,preparing,prepared,ready,delivered,completed,cancelled',
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
