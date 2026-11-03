<?php

namespace App\Services;

use App\Models\Addon;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promo;
use App\Services\FranchiseInventoryService;
use App\Support\ProductOptionRules;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class PromoRedemptionService
{
    public function rateLimitRetryAfter(Request $request, ?string $userId): ?int
    {
        foreach ($this->rateLimitKeys($request, $userId) as $key) {
            if (RateLimiter::tooManyAttempts($key, 5)) {
                return RateLimiter::availableIn($key);
            }
        }

        return null;
    }

    public function recordInvalidAttempt(Request $request, ?string $userId, string $code, string $errorCode): void
    {
        foreach ($this->rateLimitKeys($request, $userId) as $key) {
            RateLimiter::hit($key, 60);
        }

        Log::notice('Promo validation failed.', [
            'user_id' => $userId,
            'ip' => $request->ip(),
            'code_hash' => hash('sha256', $code),
            'error_code' => $errorCode,
            'attempted_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * @return array{promo: Promo, code: string, discount: float}
     */
    public function evaluate(
        string $code,
        array $items,
        ?string $userId = null,
        bool $lock = false,
        string $channel = 'customer',
        ?string $franchiseId = null,
    ): array
    {
        $normalizedCode = strtoupper((string) preg_replace('/\s+/', '', trim($code)));
        $query = Promo::query()->whereRaw('UPPER(code) = ?', [$normalizedCode]);
        if ($lock) {
            $query->lockForUpdate();
        }
        $promo = $query->first();

        $allowedChannels = $channel === 'cashier' ? ['all', 'onsite', 'cashier'] : ['all', 'online'];
        if (! $promo || ! $promo->is_active || ! in_array($promo->channel ?? 'all', $allowedChannels, true)) {
            throw new PromoRedemptionException('PROMO_INVALID', "This promo code isn't valid. Please check and try again.");
        }

        $now = now('Asia/Manila');
        if ($promo->start_date && Carbon::parse($promo->start_date)->timezone('Asia/Manila')->gt($now)) {
            throw new PromoRedemptionException('PROMO_NOT_STARTED', "This promo code isn't active yet.");
        }
        if ($promo->end_date && Carbon::parse($promo->end_date)->timezone('Asia/Manila')->lt($now)) {
            throw new PromoRedemptionException('PROMO_EXPIRED', 'This promo code has expired.');
        }
        $productIds = collect($items)->map(fn (array $item) => (string) ($item['product_id'] ?? $item['id'] ?? ''))
            ->filter()->unique()->values();
        $products = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');
        $branchPrices = $franchiseId
            ? app(FranchiseInventoryService::class)->branchPriceOverrides($franchiseId, $productIds->all())
            : [];
        $categories = array_map('strtolower', $promo->applicable_categories ?? []);
        if (array_intersect($categories, ['all', 'all_categories']) !== []) {
            $categories = [];
        }
        $productFilters = array_map('strval', $promo->applicable_products ?? []);
        $hasFilters = $categories !== [] || $productFilters !== [];
        $subtotal = 0.0;
        $eligibleSubtotal = 0.0;

        foreach ($items as $item) {
            $productId = (string) ($item['product_id'] ?? $item['id'] ?? '');
            $product = $products->get($productId);
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            if (! $product) {
                continue;
            }

            ProductOptionRules::validateSelections($product, $item);
            $unitPrice = $branchPrices[$product->id] ?? (float) $product->price;
            $addonIds = collect($item['selected_addons'] ?? $item['selectedAddons'] ?? [])
                ->pluck('id')->filter()->unique();
            $addons = Addon::query()->whereIn('id', $addonIds)->get()->keyBy('id');
            $addonTotal = collect($item['selected_addons'] ?? $item['selectedAddons'] ?? [])
                ->sum(fn (array $addon) => (float) ($addons->get($addon['id'] ?? null)?->price ?? 0)
                    * max(1, (int) ($addon['quantity'] ?? 1)));
            $lineTotal = max(0, $unitPrice + $addonTotal) * $quantity;
            $subtotal += $lineTotal;

            $matches = ! $hasFilters
                || in_array((string) $product->id, $productFilters, true)
                || in_array(strtolower((string) $product->category), $categories, true);
            if ($matches) {
                $eligibleSubtotal += $lineTotal;
            }

        }

        $subtotal = round($subtotal, 2);
        $eligibleSubtotal = round($eligibleSubtotal, 2);
        if ($eligibleSubtotal <= 0) {
            throw new PromoRedemptionException('PROMO_NO_APPLICABLE_ITEMS', "This promo doesn't apply to the items in your cart.");
        }
        $minimum = (float) $promo->min_order_amount;
        if ($subtotal < $minimum) {
            $remaining = round($minimum - $subtotal, 2);
            throw new PromoRedemptionException(
                'PROMO_MIN_ORDER',
                'Add ₱'.number_format($remaining, 2).' more to use this promo.',
                $remaining,
            );
        }
        if ($promo->usage_limit !== null && $promo->times_used >= $promo->usage_limit) {
            throw new PromoRedemptionException('PROMO_USAGE_LIMIT', 'This promo code has reached its usage limit.');
        }
        if ($userId && $promo->per_customer_limit !== null) {
            $customerUsage = Order::query()
                ->where('promo_id', $promo->id)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->pluck('id')
                ->count();
            if ($customerUsage >= $promo->per_customer_limit) {
                throw new PromoRedemptionException('PROMO_USAGE_LIMIT', 'This promo code has reached its usage limit.');
            }
        }

        $discount = $promo->discount_type === 'percent'
            ? round($eligibleSubtotal * ((float) $promo->discount_value / 100), 2)
            : min((float) $promo->discount_value, $eligibleSubtotal);
        if ($promo->discount_type === 'percent' && $promo->max_discount_amount !== null && (float) $promo->max_discount_amount > 0) {
            $discount = min($discount, (float) $promo->max_discount_amount);
        }

        return [
            'promo' => $promo,
            'code' => $normalizedCode,
            'discount' => min(round($discount, 2), $eligibleSubtotal),
        ];
    }

    private function rateLimitKeys(Request $request, ?string $userId): array
    {
        $keys = ['promo-invalid:ip:'.hash('sha256', (string) $request->ip())];
        if ($userId) {
            $keys[] = 'promo-invalid:user:'.hash('sha256', $userId);
        }

        return $keys;
    }
}
