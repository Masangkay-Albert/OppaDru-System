<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Addon;
use App\Models\Employee;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Promo;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use App\Services\Order\OrderDataService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait FranchisePosOrderActions
{
    public function storePosOrder(Request $request)
    {
        $user = $request->user();
        if (! $this->canProcessBranchPos($user)) {
            return response()->json(['message' => 'Cashier access or explicit POS permission is required.'], 403);
        }
        $cashierEmployeeId = $user instanceof Employee ? $user->id : null;
        $franchiseUserId = $user instanceof FranchiseUser ? $user->id : null;
        $employeePosRequest = $request->is('api/employee/pos/orders');

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*' => 'required|array',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:99',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|integer|exists:addons,id',
            'items.*.selected_addons.*.quantity' => 'nullable|integer|min:1|max:20',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'customer_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'table_number' => 'nullable|string|max:30',
            'dining_option' => 'required|string|in:dine_in,takeout',
            'payment_method' => 'required|string|in:cash,gcash,credit_card',
            'payment_reference' => 'required_if:payment_method,gcash|nullable|string|max:100',
            'terminal_reference' => 'required_if:payment_method,credit_card|nullable|string|max:100',
            'cash_tendered' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'discount_id_number' => 'required_with:discount_type|nullable|string|max:100',
            'discount_cardholder_name' => 'nullable|string|max:255',
            'promo_id' => 'nullable|string|exists:promos,id',
            'promo_code' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:500',
            'include_cutlery' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the POS order details.',
                'errors' => $validator->errors(),
            ], $employeePosRequest ? 400 : 422);
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
                'category' => $product->category,
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
        $hasUnavailableAddons = $addonIds->isNotEmpty() && (
            $addons->count() !== $addonIds->count()
            || $addons->contains(fn (Addon $addon) => ! $addon->group
                || ! $addon->is_active
                || ($addon->franchise_id !== null && (string) $addon->franchise_id !== (string) $user->franchise_id)
                || ($addon->group->franchise_id !== null && (string) $addon->group->franchise_id !== (string) $user->franchise_id))
        );
        if ($hasUnavailableAddons) {
            return response()->json(['message' => 'One or more add-ons are not available at this branch.'], 422);
        }
        foreach ($items as $item) {
            $groups = collect($item['selected_addons'])
                ->groupBy(fn (array $selection) => $addons->get($selection['id'])?->addon_group_id);
            foreach ($groups as $groupId => $selections) {
                $group = $addons->get($selections->first()['id'])?->group;
                if (! $group || ($group->selection_type === 'single' && $selections->count() > 1)
                    || ($group->max_selections !== null && $selections->count() > $group->max_selections)
                    || (! $group->supports_quantity && $selections->contains(fn (array $selection) => (int) ($selection['quantity'] ?? 1) > 1))) {
                    return response()->json([
                        'message' => 'The selected add-ons exceed the allowed choices for this product.',
                    ], 422);
                }
            }
        }

        $inventoryService = app(FranchiseInventoryService::class);
        $availableProductIds = $inventoryService
            ->catalog((string) $user->franchise_id, true)
            ->pluck('id')
            ->all();
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
        $promo = null;
        $promoDiscount = 0.0;
        if ($request->filled('promo_id') || $request->filled('promo_code')) {
            $promoQuery = Promo::active();
            $promo = $promoQuery
                ->where(function ($query) use ($request) {
                    if ($request->filled('promo_id')) {
                        $query->where('id', $request->input('promo_id'));
                    }
                    if ($request->filled('promo_code')) {
                        $method = $request->filled('promo_id') ? 'orWhere' : 'where';
                        $query->{$method}('code', strtoupper(trim((string) $request->input('promo_code'))));
                    }
                })
                ->first();
            if (! $promo) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected promo is no longer available.',
                ], $employeePosRequest ? 400 : 422);
            }
            $promoDiscount = $promo->calculateDiscount($subtotal, $items);
            if ($promoDiscount <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected promo does not apply to this order.',
                ], $employeePosRequest ? 400 : 422);
            }
        }
        $total = max(0, round($posTotals['total'] - $promoDiscount));
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
            if (! $gatewayPayment
                || data_get($gatewayPayment->metadata, 'purpose') !== 'franchise_pos'
                || (string) data_get($gatewayPayment->metadata, 'franchise_id') !== (string) $user->franchise_id
                || data_get($gatewayPayment->metadata, 'cashier_employee_id') !== $cashierEmployeeId
                || data_get($gatewayPayment->metadata, 'franchise_user_id') !== $franchiseUserId
                || round((float) $gatewayPayment->amount) !== $total) {
                return response()->json([
                    'message' => 'Payment must be confirmed by the payment gateway for the exact POS total before completing this order.',
                ], 422);
            }
        }

        $diningLabel = $request->input('dining_option') === 'dine_in' ? 'Dine In' : 'Takeout';
        $customerName = trim((string) $request->input('customer_name', 'Walk-in Customer')) ?: 'Walk-in Customer';
        $deliveryAddress = "Onsite - {$diningLabel} (Customer: {$customerName})";
        if ($request->filled('table_number') && $request->input('dining_option') === 'dine_in') {
            $deliveryAddress .= ' | Table '.trim((string) $request->input('table_number'));
        }
        if ($request->filled('notes')) {
            $deliveryAddress .= ' | Notes: '.trim((string) $request->input('notes'));
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
                $subtotal,
                $promo,
                $promoDiscount,
                $gatewayPayment,
                $cashTendered,
                $cashierEmployeeId,
                $franchiseUserId
            ) {
                $inventoryService->consume((string) $user->franchise_id, $items);
                if ($promo) {
                    $promo = Promo::whereKey($promo->id)->lockForUpdate()->first();
                    if (! $promo || ! $promo->isValidForSubtotal($subtotal)) {
                        throw new \InvalidArgumentException('The selected promo is no longer available.');
                    }
                    $promo->increment('times_used');
                }
                if ($gatewayPayment) {
                    $gatewayPayment = Payment::whereKey($gatewayPayment->id)->lockForUpdate()->first();
                    if (! $gatewayPayment || $gatewayPayment->status !== 'paid' || $gatewayPayment->order_id !== null
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
                    'branch_id' => $user->franchise_id,
                    'cashier_employee_id' => $cashierEmployeeId,
                    'franchise_user_id' => $franchiseUserId,
                    'include_cutlery' => $request->boolean('include_cutlery'),
                    'email' => $user->email,
                    'total' => $total,
                    'cash_tendered' => $paymentMethod === 'cash' ? round($cashTendered, 2) : null,
                    'change_due' => $paymentMethod === 'cash' ? round($cashTendered - $total, 2) : null,
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
                        ? 'CASH-'.strtoupper(Str::random(8))
                        : (
                            $paymentMethod === 'gcash'
                                ? $gatewayPayment->reference
                                : $request->input('terminal_reference')
                        ),
                    'phone' => trim((string) $request->input('phone', '')),
                    'items' => $orderItems,
                    'vat' => $discountType ? 0 : round($total * 12 / 112, 2),
                    'discount_type' => $discountType,
                    'discount_rate' => $discountType ? $discountRate : null,
                    'discount_amount' => $discountType ? $discountAmount : null,
                    'promo_id' => $promo?->id,
                    'promo_code' => $promo?->code,
                    'promo_discount' => $promoDiscount > 0 ? $promoDiscount : null,
                    'discount_status' => $discountType ? 'approved' : 'not_requested',
                    'discount_proof_image' => $discountType
                        ? 'Verified ID: '
                            .trim((string) $request->input('discount_cardholder_name'))
                            .' ('.$request->input('discount_id_number').')'
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
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], $employeePosRequest ? 400 : 422);
        }

        $order = $order->refresh()->load('branch:id,name');
        $order->setAttribute('branch_name', $order->branch?->name);
        if ($employeePosRequest) {
            $manilaNow = now('Asia/Manila');
            $currentMonth = $manilaNow->format('Y_m');
            $weekStart = $manilaNow->copy()->startOfWeek(\Carbon\Carbon::MONDAY)->format('Ymd');
            $today = $manilaNow->format('Ymd');
            foreach ([5, 100] as $limit) {
                Cache::forget("employee_pos_top_products_{$user->franchise_id}_{$currentMonth}_{$limit}");
                Cache::forget("employee_pos_top_products_{$user->franchise_id}_week_{$weekStart}_{$limit}");
                Cache::forget("employee_pos_top_products_{$user->franchise_id}_today_{$today}_{$limit}");
            }
        }
        $orderResponse = $order;
        if ($employeePosRequest) {
            $orderResponse = $order->toArray();
            $orderResponse['orderNumber'] = $order->order_number;
        }

        return response()->json([
            'success' => true,
            'order' => $orderResponse,
            'subtotal' => round($subtotal),
            'discount_amount' => $discountAmount,
            'promo_discount' => $promoDiscount,
            'change_due' => $paymentMethod === 'cash' ? round($cashTendered - $total, 2) : 0,
            'message' => 'Franchise POS order placed successfully.',
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
}
