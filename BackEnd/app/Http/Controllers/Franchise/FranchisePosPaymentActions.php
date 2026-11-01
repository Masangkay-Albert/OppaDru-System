<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Addon;
use App\Models\Employee;
use App\Models\FranchiseUser;
use App\Models\Payment;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use App\Services\Payment\PaymentHelperService;
use App\Services\PricingService;
use App\Services\PromoRedemptionException;
use App\Services\PromoRedemptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

trait FranchisePosPaymentActions
{
    public function createPosPayment(Request $request)
    {
        $user = $request->user();
        if (! $this->canProcessBranchPos($user)) {
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
            'promo_code' => 'nullable|string|max:50',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Please check the POS payment details.',
                'errors' => $validator->errors(),
            ], 422);
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

        $addonIds = collect($items)
            ->flatMap(fn (array $item) => collect($item['selected_addons'])->pluck('id'))
            ->unique();
        $addons = Addon::with('group')->whereIn('id', $addonIds)->get()->keyBy('id');
        $hasUnavailableAddons = $addons->count() !== $addonIds->count()
            || $addons->contains(fn (Addon $addon) => ! $addon->group || ! $addon->group->is_active
                || ($addon->franchise_id !== null && (string) $addon->franchise_id !== (string) $user->franchise_id)
                || ($addon->group->franchise_id !== null && (string) $addon->group->franchise_id !== (string) $user->franchise_id));
        if ($hasUnavailableAddons) {
            return response()->json(['message' => 'One or more add-ons are not available at this branch.'], 422);
        }
        foreach ($items as $item) {
            $selectionsByGroup = collect($item['selected_addons'])
                ->groupBy(fn (array $selection) => $addons->get($selection['id'])?->addon_group_id);
            foreach ($selectionsByGroup as $selections) {
                $group = $addons->get($selections->first()['id'])?->group;
                if (! $group || ($group->selection_type === 'single' && $selections->count() > 1)
                    || ($group->max_selections !== null && $selections->count() > $group->max_selections)
                    || (! $group->supports_quantity && $selections->contains(fn (array $selection) => (int) ($selection['quantity'] ?? 1) > 1))) {
                    return response()->json([
                        'message' => 'The selected add-ons exceed the allowed choices for this product.',
                    ], 422);
                }
            }
            $isSizeRequired = in_array(
                strtolower($products->get($item['product_id'])->category),
                ['fruity-soda-milk', 'fresh-lemonade'],
                true
            );
            if ($isSizeRequired
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
        $promoCode = trim((string) $request->input('promo_code', ''));
        $promoDiscount = 0.0;
        if ($promoCode !== '') {
            $redemptionService = app(PromoRedemptionService::class);
            $retryAfter = $redemptionService->rateLimitRetryAfter($request, (string) $user->getAuthIdentifier());
            if ($retryAfter !== null) {
                return response()->json([
                    'message' => 'Too many attempts. Please wait a minute and try again.',
                    'error_code' => 'PROMO_RATE_LIMITED',
                ], 429);
            }
            try {
                $promoDiscount = $redemptionService->evaluate(
                    $promoCode,
                    $items,
                    null,
                    false,
                    'cashier',
                )['discount'];
            } catch (PromoRedemptionException $exception) {
                $redemptionService->recordInvalidAttempt(
                    $request,
                    (string) $user->getAuthIdentifier(),
                    strtoupper((string) preg_replace('/\s+/', '', $promoCode)),
                    $exception->errorCode,
                );

                return response()->json([
                    'message' => $exception->getMessage(),
                    'error_code' => $exception->errorCode,
                ], 422);
            }
        }
        $amount = max(0, round($posTotals['total'] - $promoDiscount));

        $reference = app(PaymentHelperService::class)->generateReferenceNumber();
        $posPath = $user instanceof Employee ? '/cashier/pos' : '/franchise/pos';
        $frontendUrl = rtrim((string) (config('app.frontend_url') ?: $request->header('Origin') ?: url('/')), '/');
        $checkoutUrl = $frontendUrl.'/payment/confirm/'.$reference.'?amount='.$amount.'&returnUrl='.urlencode($posPath);

        $payment = Payment::create([
            'reference' => $reference,
            'provider' => 'simulated_gcash',
            'provider_id' => $reference,
            'amount' => $amount,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
            'metadata' => [
                'purpose' => 'franchise_pos',
                'franchise_id' => (string) $user->franchise_id,
                'cashier_employee_id' => $user instanceof Employee ? $user->id : null,
                'franchise_user_id' => $user instanceof FranchiseUser ? $user->id : null,
                'source_status' => 'pending',
                'checkout_url' => $checkoutUrl,
                'promo_code' => $promoCode !== '' ? strtoupper((string) preg_replace('/\s+/', '', $promoCode)) : null,
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'reference' => $payment->reference,
                'checkout_url' => $checkoutUrl,
                'amount' => (float) $payment->amount,
                'expires_at' => $payment->expires_at?->toISOString(),
            ],
        ], 201);
    }
}
