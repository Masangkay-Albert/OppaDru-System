<?php

namespace App\Http\Controllers;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Employee;
use App\Models\Driver;
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
                ->where(function ($query) {
                    $query->whereNull('franchise_account_id')
                        ->orWhereHas('franchiseAccount', fn ($accountQuery) => $accountQuery->where('status', 'active'));
                })
                ->orderBy('name')
                ->get(['id', 'name', 'address']),
        ]);
    }

    public function managementInformation(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser) {
            return response()->json(['message' => 'Franchise manager access required.'], 403);
        }

        $user->load(['franchise', 'franchiseAccount.locations']);
        $locations = $user->franchiseAccount
            ? $user->franchiseAccount->locations->sortBy('name')->values()
            : collect([$user->franchise])->filter()->values();

        return response()->json([
            'data' => [
                'franchise' => $user->franchiseAccount,
                'assigned_location' => $user->franchise,
                'locations' => $locations,
                'manager' => $user->makeHidden(['password', 'api_token']),
            ],
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
                'total_revenue' => (float) $orders()->countedAsRevenue()->sum('total'),
                'average_order_value' => (float) $orders()->countedAsRevenue()->avg('total'),
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
                'total_revenue' => (float) $orders()->countedAsRevenue()->sum('total'),
                'average_order_value' => (float) $orders()->countedAsRevenue()->avg('total'),
                'status_breakdown' => $orders()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            ],
        ]);
    }

    public function storePosOrder(Request $request)
    {
        $user = $request->user();
        if (!$this->canProcessBranchPos($user)) {
            return response()->json(['message' => 'Cashier access or explicit POS permission is required.'], 403);
        }
        $cashierEmployeeId = $user instanceof Employee ? $user->id : null;
        $franchiseUserId = $user instanceof FranchiseUser ? $user->id : null;

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
            'payment_method' => 'required|string|in:cash,gcash,credit_card',
            'payment_reference' => 'required_if:payment_method,gcash|nullable|string|max:100',
            'terminal_reference' => 'required_if:payment_method,credit_card|nullable|string|max:100',
            'cash_tendered' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'discount_id_number' => 'required_with:discount_type|nullable|string|max:100',
            'discount_cardholder_name' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'include_cutlery' => 'nullable|boolean',
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
                || !$addon->is_active
                || ($addon->franchise_id !== null && (string) $addon->franchise_id !== (string) $user->franchise_id)
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
        $subtotal = max(0, round($pricing['subtotal']));
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
        $posTotals = app(PricingService::class)->calculatePosDiscount($subtotal, (bool) $discountType);
        $discountAmount = $posTotals['discountAmount'];
        $total = $posTotals['total'];
        $paymentMethod = $request->input('payment_method');
        $cashTendered = (float) $request->input('cash_tendered', 0);

        if ($paymentMethod === 'cash' && $cashTendered < $total) {
            return response()->json(['message' => 'Cash tendered must cover the order total.'], 422);
        }
        $gatewayPayment = null;
        if ($paymentMethod === 'gcash') {
            $gatewayPayment = Payment::where('reference', $request->input('payment_reference'))
                ->where('status', 'paid')
                ->whereNull('order_id')
                ->first();
            if (!$gatewayPayment
                || data_get($gatewayPayment->metadata, 'purpose') !== 'franchise_pos'
                || (string) data_get($gatewayPayment->metadata, 'franchise_id') !== (string) $user->franchise_id
                || data_get($gatewayPayment->metadata, 'cashier_employee_id') !== $cashierEmployeeId
                || data_get($gatewayPayment->metadata, 'franchise_user_id') !== $franchiseUserId
                || round((float) $gatewayPayment->amount) !== $total) {
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
                $gatewayPayment,
                $cashierEmployeeId,
                $franchiseUserId
            ) {
                $inventoryService->consume((string) $user->franchise_id, $items);
                if ($gatewayPayment) {
                    $gatewayPayment = Payment::whereKey($gatewayPayment->id)->lockForUpdate()->first();
                    if (!$gatewayPayment || $gatewayPayment->status !== 'paid' || $gatewayPayment->order_id !== null
                        || data_get($gatewayPayment->metadata, 'purpose') !== 'franchise_pos'
                        || (string) data_get($gatewayPayment->metadata, 'franchise_id') !== (string) $user->franchise_id
                        || data_get($gatewayPayment->metadata, 'cashier_employee_id') !== $cashierEmployeeId
                        || data_get($gatewayPayment->metadata, 'franchise_user_id') !== $franchiseUserId
                        || round((float) $gatewayPayment->amount) !== $total) {
                        throw new \InvalidArgumentException('This payment is no longer available for this order.');
                    }
                }
                $order = Order::create([
                    'franchise_id' => $user->franchise_id,
                    'cashier_employee_id' => $cashierEmployeeId,
                    'franchise_user_id' => $franchiseUserId,
                    'include_cutlery' => $request->boolean('include_cutlery'),
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
                        : ($paymentMethod === 'gcash' ? $gatewayPayment->reference : $request->input('terminal_reference')),
                    'phone' => $request->input('phone', ''),
                    'items' => $orderItems,
                    'vat' => $discountType ? 0 : round($total * 0.12),
                    'discount_type' => $discountType,
                    'discount_rate' => $discountType ? $discountRate : null,
                    'discount_amount' => $discountType ? $discountAmount : null,
                    'discount_status' => $discountType ? 'approved' : 'not_requested',
                    'discount_proof_image' => $discountType
                        ? 'Verified ID: ' . trim((string) $request->input('discount_cardholder_name')) . ' (' . $request->input('discount_id_number') . ')'
                        : null,
                    'special_instructions' => $request->input('notes'),
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
            'subtotal' => round($subtotal),
            'discount_amount' => $discountAmount,
            'change_due' => $paymentMethod === 'cash' ? round($cashTendered - $total, 2) : 0,
            'message' => 'Franchise POS order placed successfully.',
        ], 201);
    }

    public function createPosPayment(Request $request)
    {
        $user = $request->user();
        if (!$this->canProcessBranchPos($user)) {
            return response()->json(['message' => 'Cashier access or explicit POS permission is required.'], 403);
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
                || ($addon->franchise_id !== null && (string) $addon->franchise_id !== (string) $user->franchise_id)
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
        $subtotal = max(0, round($pricing['subtotal']));
        $posTotals = app(PricingService::class)->calculatePosDiscount($subtotal, $request->filled('discount_type'));
        $amount = $posTotals['total'];

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
                        'success' => rtrim(config('app.frontend_url'), '/') . ($user instanceof Employee ? '/cashier/pos' : '/franchise/pos') . '?payment_reference=' . $reference,
                        'failed' => rtrim(config('app.frontend_url'), '/') . ($user instanceof Employee ? '/cashier/pos' : '/franchise/pos') . '?payment_reference=' . $reference,
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
                'cashier_employee_id' => $user instanceof Employee ? $user->id : null,
                'franchise_user_id' => $user instanceof FranchiseUser ? $user->id : null,
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

    private function canProcessBranchPos($user): bool
    {
        if ($user instanceof Employee) {
            return $user->is_active
                && $user->franchise_id !== null
                && strtolower((string) $user->position) === 'cashier';
        }

        return $user instanceof FranchiseUser
            && $user->is_active
            && $user->can_process_pos
            && $user->franchise_id !== null;
    }

    public function employeePosProducts(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof Employee || !$user->franchise_id || strtolower((string) $user->position) !== 'cashier') {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        return response()->json([
            'data' => app(FranchiseInventoryService::class)->catalog((string) $user->franchise_id, true),
        ]);
    }

    public function employeePosOrders(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof Employee || !$user->franchise_id || strtolower((string) $user->position) !== 'cashier') {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        return response()->json([
            'data' => Order::where('franchise_id', $user->franchise_id)
                ->where('cashier_employee_id', $user->id)
                ->where('delivery_type', 'onsite')
                ->orderByDesc('created_at')
                ->limit(100)
                ->get(['id', 'order_number', 'total', 'payment_method', 'payment_status', 'payment_reference', 'status', 'created_at']),
        ]);
    }

    public function franchisePosOrders(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
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

        $query = Order::where('franchise_id', $user->franchise_id)
            ->where('delivery_type', 'onsite')
            ->with([
                'franchise.franchiseAccount:id,name',
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
                'average_order_value' => (float) $branchOrders()->countedAsRevenue()->avg('total'),
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
            ->get(['id', 'franchise_id', 'fullName', 'email', 'position', 'is_active', 'created_at'])
            ->map(fn (Employee $employee) => [
                'id' => $employee->id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'phone' => null,
                'role' => str_replace(' ', '_', strtolower($employee->position)),
                'status' => $employee->is_active ? 'active' : 'inactive',
                'user_type' => 'employee',
                'franchise_id' => $employee->franchise_id,
                'created_at' => $employee->created_at,
            ]);
        $drivers = Driver::where('franchise_id', $user->franchise_id)
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'phone', 'isActive', 'created_at'])
            ->map(fn (Driver $driver) => [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'phone' => $driver->phone,
                'role' => 'driver',
                'status' => $driver->isActive ? 'active' : 'inactive',
                'user_type' => 'driver',
                'created_at' => $driver->created_at,
            ]);

        return response()->json(['data' => $managerUsers->concat($employees)->concat($drivers)->sortByDesc('created_at')->values()]);
    }

    public function storeBranchUser(Request $request)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:cashier,kitchen_staff,staff,driver',
            'vehicle_type' => 'required_if:role,driver|nullable|string|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $email = strtolower(trim((string) $request->email));
        if (FranchiseUser::where('email', $email)->exists()
            || Employee::where('email', $email)->exists()
            || Driver::where('email', $email)->exists()) {
            return response()->json(['message' => 'This email address is already assigned to an account.'], 422);
        }

        if ($request->role === 'driver') {
            $branchUser = Driver::create([
                'franchise_id' => $user->franchise_id,
                'name' => $request->name,
                'email' => $email,
                'phone' => $request->input('phone', ''),
                'password' => (string) $request->password,
                'vehicleType' => $request->vehicle_type,
                'isActive' => true,
            ]);
            $data = [
                'id' => $branchUser->id,
                'franchise_id' => $branchUser->franchise_id,
                'name' => $branchUser->name,
                'email' => $branchUser->email,
                'phone' => $branchUser->phone,
                'role' => 'driver',
                'status' => 'active',
                'user_type' => 'driver',
                'created_at' => $branchUser->created_at,
            ];
        } else {
            $branchUser = Employee::create([
                'franchise_id' => $user->franchise_id,
                'fullName' => $request->name,
                'email' => $email,
                'password' => (string) $request->password,
                'position' => match ($request->role) {
                    'kitchen_staff' => 'kitchen staff',
                    'staff' => 'staff',
                    default => 'cashier',
                },
                'is_active' => true,
            ]);
            $data = [
                'id' => $branchUser->id,
                'franchise_id' => $branchUser->franchise_id,
                'name' => $branchUser->fullName,
                'email' => $branchUser->email,
                'phone' => $request->input('phone'),
                'role' => str_replace(' ', '_', strtolower($branchUser->position)),
                'status' => 'active',
                'user_type' => 'employee',
                'created_at' => $branchUser->created_at,
            ];
        }

        return response()->json(['data' => $data, 'message' => 'Branch staff account created successfully.'], 201);
    }

    public function updateBranchUserStatus(Request $request, string $type, string $id)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }
        $validated = $request->validate(['is_active' => 'required|boolean']);

        if ($type === 'employee') {
            $staff = Employee::where('franchise_id', $user->franchise_id)->findOrFail($id);
            $staff->is_active = $validated['is_active'];
        } elseif ($type === 'driver') {
            $staff = Driver::where('franchise_id', $user->franchise_id)->findOrFail($id);
            $staff->isActive = $validated['is_active'];
        } else {
            return response()->json(['message' => 'Unsupported branch user type.'], 422);
        }
        $staff->save();

        return response()->json(['message' => 'Branch staff status updated.']);
    }

    public function updateBranchEmployee(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user instanceof FranchiseUser || !$user->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $employee = Employee::where('franchise_id', $user->franchise_id)->findOrFail($id);
        $validated = $request->validate([
            'position' => 'sometimes|required|in:cashier,kitchen staff,staff',
            'is_active' => 'sometimes|boolean',
        ]);
        if ($validated === []) {
            return response()->json(['message' => 'Provide a staff role or status to update.'], 422);
        }

        if (array_key_exists('position', $validated)) {
            $employee->position = $validated['position'];
        }
        if (array_key_exists('is_active', $validated)) {
            $employee->is_active = $validated['is_active'];
        }
        $employee->save();

        return response()->json([
            'data' => [
                'id' => $employee->id,
                'franchise_id' => $employee->franchise_id,
                'name' => $employee->fullName,
                'email' => $employee->email,
                'role' => str_replace(' ', '_', strtolower($employee->position)),
                'status' => $employee->is_active ? 'active' : 'inactive',
            ],
            'message' => 'Branch staff updated.',
        ]);
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
        $salesOrders = $orders->filter(fn (Order $order) => $order->isCountedAsRevenue());
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
                'average_order_value' => (float) $orders()->countedAsRevenue()->avg('total'),
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
            'can_process_pos' => 'nullable|boolean',
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
            'can_process_pos' => $request->boolean('can_process_pos', false),
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
            'can_process_pos' => 'sometimes|boolean',
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
        if ($request->has('can_process_pos')) {
            $user->can_process_pos = $request->boolean('can_process_pos');
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
        $salesOrders = fn () => Order::where('franchise_id', $branchId)->countedAsRevenue();
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
