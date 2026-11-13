<?php

namespace App\Http\Controllers;

use App\Models\Promo;
use App\Services\PromoRedemptionException;
use App\Services\PromoRedemptionService;
use App\Support\DatabaseImage;
use App\Traits\AdminAuthTrait;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator as LaravelValidator;

class PromoController extends Controller
{
    use AdminAuthTrait;

    public function adminIndex(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $request->validate([
            'channel' => 'sometimes|in:all,online,onsite',
        ]);

        $query = Promo::query();

        if ($request->filled('status')) {
            $status = $request->status;
            $now = now();
            if ($status === 'active') {
                $query->where('is_active', true)
                    ->where(function ($q) use ($now) {
                        $q->whereNull('start_date')->orWhere('start_date', '<=', $now);
                    })
                    ->where(function ($q) use ($now) {
                        $q->whereNull('end_date')->orWhere('end_date', '>=', $now);
                    });
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            } elseif ($status === 'expired') {
                $query->where('end_date', '<', $now);
            }
        }

        if ($request->filled('channel') && $request->channel !== 'all') {
            $query->where('channel', $request->channel);
        }

        if ($request->filled('search')) {
            $search = '%' . trim((string) $request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                    ->orWhere('code', 'like', $search)
                    ->orWhere('description', 'like', $search);
            });
        }

        $promos = $query->orderBy('created_at', 'desc')->get();

        return response()->json($promos->map(fn (Promo $promo) => $this->formatPromo($promo)));
    }

    public function employeeIndex()
    {
        return response()->json(
            Promo::active()->whereIn('channel', ['all', 'onsite'])
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (Promo $promo) => $this->formatPromo($promo))
                ->values()
        );
    }

    public function store(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $this->decodeJsonInputs($request);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|min:'.config('input_limits.announcement_title.min').'|max:'.config('input_limits.announcement_title.max'),
            'description' => 'nullable|string|max:'.config('input_limits.long_text'),
            'code' => ['nullable', 'string', 'min:'.config('input_limits.promo_code.min'), 'max:'.config('input_limits.promo_code.max'), 'regex:'.config('input_limits.promo_code.pattern'), 'unique:promos,code'],
            'channel' => 'sometimes|in:all,online,onsite',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => [
                'required',
                'regex:/^\d+(?:\.\d{1,2})?$/',
                'numeric',
                'min:0.01',
                'max:'.($request->input('discount_type') === 'percent' ? config('input_limits.percentage') : config('input_limits.amount')),
            ],
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|file|image|mimes:jpeg,jpg,png,webp|max:5120',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
            'min_order_amount' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('input_limits.amount')],
            'max_discount_amount' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('input_limits.amount')],
            'usage_limit' => 'nullable|integer|min:1|max:999999',
            'per_customer_limit' => 'nullable|integer|min:1|max:999999',
        ]);
        $validator->after(fn (LaravelValidator $validator) => $this->validatePromoDateYears($validator, $request));

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        $data['channel'] = $data['channel'] ?? 'all';
        $data['is_active'] = $request->boolean('is_active', true);

        if ($request->hasFile('image')) {
            $data['image'] = DatabaseImage::fromUploadedFile($request->file('image'));
        }

        $promo = Promo::create($data);

        return response()->json([
            'message' => 'Promo created successfully!',
            'promo' => $this->formatPromo($promo),
        ], 201);
    }

    public function show(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $promo = Promo::where('id', $id)->orWhere('code', strtoupper($id))->firstOrFail();

        return response()->json($this->formatPromo($promo));
    }

    public function image(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $promo = Promo::select(['id', 'image'])->findOrFail($id);
        $imageData = $promo->getRawOriginal('image');

        if (! is_string($imageData) || ! str_starts_with($imageData, 'data:image/')) {
            abort(404, 'Promo image not found.');
        }

        return DatabaseImage::response($imageData);
    }

    public function update(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $promo = Promo::findOrFail($id);

        $this->decodeJsonInputs($request);

        $requestedTitle = $request->input('title');
        $titleUnchanged = $request->exists('title')
            && is_string($requestedTitle)
            && trim($requestedTitle) === trim((string) $promo->title);
        $requestedDescription = $request->input('description');
        $descriptionUnchanged = $request->exists('description')
            && is_string($requestedDescription)
            && trim($requestedDescription) === trim((string) $promo->description);
        $requestedCode = $request->input('code');
        $codeUnchanged = $request->exists('code')
            && is_string($requestedCode)
            && trim($requestedCode) === trim((string) $promo->code);
        $numericUnchanged = function (string $field) use ($request, $promo): bool {
            if (! $request->exists($field) || $promo->getRawOriginal($field) === null) {
                return false;
            }
            $value = (string) $request->input($field);
            return preg_match('/^\d+(?:\.\d{1,2})?$/', $value) === 1
                && bccomp($value, (string) $promo->getRawOriginal($field), 2) === 0;
        };
        $discountTypeUnchanged = ! $request->exists('discount_type')
            || $request->input('discount_type') === $promo->discount_type;
        $discountValueUnchanged = $discountTypeUnchanged && $numericUnchanged('discount_value');
        $minOrderUnchanged = $numericUnchanged('min_order_amount');
        $maxDiscountUnchanged = $numericUnchanged('max_discount_amount');
        $usageLimitUnchanged = $request->exists('usage_limit')
            && (string) $request->input('usage_limit') === (string) $promo->usage_limit;
        $perCustomerLimitUnchanged = $request->exists('per_customer_limit')
            && (string) $request->input('per_customer_limit') === (string) $promo->per_customer_limit;
        $titleRules = ['sometimes', 'required', 'string'];
        if ($request->exists('title') && ! $titleUnchanged) {
            $titleRules = [...$titleRules, 'min:'.config('input_limits.announcement_title.min'), 'max:'.config('input_limits.announcement_title.max')];
        }
        $descriptionRules = ['nullable', 'string'];
        if ($request->exists('description') && ! $descriptionUnchanged) {
            $descriptionRules[] = 'max:'.config('input_limits.long_text');
        }
        $codeRules = ['nullable', 'string', 'unique:promos,code,'.$promo->id.',id'];
        if ($request->exists('code') && ! $codeUnchanged) {
            $codeRules = [
                ...$codeRules,
                'min:'.config('input_limits.promo_code.min'),
                'max:'.config('input_limits.promo_code.max'),
                'regex:'.config('input_limits.promo_code.pattern'),
            ];
        }
        $discountValueRules = ['sometimes', 'required', 'numeric'];
        if ($request->exists('discount_value') && ! $discountValueUnchanged) {
            $discountValueRules = [
                ...$discountValueRules,
                'regex:/^\d+(?:\.\d{1,2})?$/',
                'min:0.01',
                'max:'.($request->input('discount_type', $promo->discount_type) === 'percent' ? config('input_limits.percentage') : config('input_limits.amount')),
            ];
        }
        $amountRules = function (bool $unchanged, string $minimum): array {
            $rules = ['nullable', 'numeric'];
            if (! $unchanged) {
                $rules = [...$rules, 'regex:/^\d+(?:\.\d{1,2})?$/', 'min:'.$minimum, 'max:'.config('input_limits.amount')];
            }
            return $rules;
        };
        $usageRules = function (bool $unchanged): array {
            return $unchanged ? ['nullable', 'integer'] : ['nullable', 'integer', 'min:1', 'max:999999'];
        };
        $validator = Validator::make($request->all(), [
            'title' => $titleRules,
            'description' => $descriptionRules,
            'code' => $codeRules,
            'channel' => 'sometimes|required|in:all,online,onsite',
            'discount_type' => 'sometimes|required|in:percent,fixed',
            'discount_value' => $discountValueRules,
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|file|image|mimes:jpeg,jpg,png,webp|max:5120',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
            'min_order_amount' => $amountRules($minOrderUnchanged, '0'),
            'max_discount_amount' => $amountRules($maxDiscountUnchanged, '0'),
            'usage_limit' => $usageRules($usageLimitUnchanged),
            'per_customer_limit' => $usageRules($perCustomerLimitUnchanged),
        ]);
        $validator->after(fn (LaravelValidator $validator) => $this->validatePromoDateYears($validator, $request));

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        foreach ([
            'title' => $titleUnchanged,
            'description' => $descriptionUnchanged,
            'code' => $codeUnchanged,
            'discount_value' => $discountValueUnchanged,
            'min_order_amount' => $minOrderUnchanged,
            'max_discount_amount' => $maxDiscountUnchanged,
            'usage_limit' => $usageLimitUnchanged,
            'per_customer_limit' => $perCustomerLimitUnchanged,
        ] as $field => $unchanged) {
            if ($unchanged) {
                $data[$field] = $promo->getRawOriginal($field);
            }
        }

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }

        if ($request->hasFile('image')) {
            $existingImage = $promo->getRawOriginal('image');
            if (is_string($existingImage) && $existingImage !== ''
                && ! str_starts_with($existingImage, 'data:image/')
                && ! preg_match('/\Ahttps?:\/\//i', $existingImage)) {
                Storage::disk('public')->delete($promo->image);
            }
            $data['image'] = DatabaseImage::fromUploadedFile($request->file('image'));
        }

        $promo->update($data);

        return response()->json([
            'message' => 'Promo updated successfully!',
            'promo' => $this->formatPromo($promo),
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $promo = Promo::findOrFail($id);

        if ($promo->image) {
            Storage::disk('public')->delete($promo->image);
        }

        $promo->delete();

        return response()->json(['message' => 'Promo deleted successfully!']);
    }

    public function toggleActive(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $promo = Promo::findOrFail($id);
        $promo->is_active = !$promo->is_active;
        $promo->save();

        return response()->json([
            'message' => $promo->is_active ? 'Promo activated.' : 'Promo deactivated.',
            'promo' => $this->formatPromo($promo),
        ]);
    }

    public function validatePromo(Request $request, PromoRedemptionService $redemptionService)
    {
        return $this->validateCodeForChannel($request, $redemptionService, 'customer');
    }

    public function validateEmployeePromo(Request $request, PromoRedemptionService $redemptionService)
    {
        return $this->validateCodeForChannel($request, $redemptionService, 'cashier');
    }

    private function validateCodeForChannel(Request $request, PromoRedemptionService $redemptionService, string $channel)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:50',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required_without:items.*.id|string',
            'items.*.id' => 'required_without:items.*.product_id|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|string',
            'franchise_id' => 'nullable|string|exists:franchises,id',
            'items.*.selected_addons.*.quantity' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'error_code' => 'PROMO_INVALID_REQUEST',
                'message' => 'Please check the promo code and cart, then try again.',
            ], 422);
        }

        $code = strtoupper((string) preg_replace('/\s+/', '', trim((string) $request->input('code'))));
        $userId = $request->user()?->getAuthIdentifier();
        $retryAfter = $redemptionService->rateLimitRetryAfter($request, $userId);
        if ($retryAfter !== null) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'error_code' => 'PROMO_RATE_LIMITED',
                'message' => 'Too many attempts. Please wait a minute and try again.',
                'retry_after' => $retryAfter,
            ], 429);
        }

        try {
            $result = $redemptionService->evaluate(
                $code,
                $request->input('items', []),
                $userId,
                false,
                $channel,
                $request->input('franchise_id'),
            );
        } catch (PromoRedemptionException $exception) {
            $redemptionService->recordInvalidAttempt($request, $userId, $code, $exception->errorCode);

            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'error_code' => $exception->errorCode,
                'message' => $exception->getMessage(),
                'amount_remaining' => $exception->amountRemaining,
            ]);
        }

        return response()->json([
            'isValid' => true,
            'discount' => $result['discount'],
            'code' => $result['code'],
            'message' => 'Promo applied successfully!',
        ]);
    }

    private function formatPromo(Promo $promo): array
    {
        $image = $promo->getRawOriginal('image');
        $imageUrl = null;
        if (is_string($image) && $image !== '') {
            if (str_starts_with($image, 'data:image/')) {
                $version = substr(hash('sha256', $image), 0, 16);
                $imageUrl = url('/api/admin/promos/'.$promo->id.'/image').'?v='.$version;
            } elseif (preg_match('/\Ahttps?:\/\//i', $image)) {
                $imageUrl = $image;
            } else {
                $imageUrl = url('/api/storage/'.ltrim($image, '/'));
            }
        }

        $now = now();
        $isExpired = $promo->end_date && $promo->end_date->isPast();
        $hasStarted = !$promo->start_date || $promo->start_date->isPast() || $promo->start_date->isToday();
        $effectiveActive = $promo->is_active && $hasStarted && !$isExpired;

        return [
            'id' => $promo->id,
            'code' => $promo->code,
            'title' => $promo->title,
            'description' => $promo->description,
            'channel' => $promo->channel ?? 'all',
            'discount_type' => $promo->discount_type,
            'discount_value' => (float) $promo->discount_value,
            'start_date' => $promo->start_date?->toISOString(),
            'end_date' => $promo->end_date?->toISOString(),
            'is_active' => (bool) $promo->is_active,
            'is_expired' => (bool) $isExpired,
            'is_effective_active' => (bool) $effectiveActive,
            'image' => $image,
            'image_url' => $imageUrl,
            'applicable_categories' => $promo->applicable_categories ?: [],
            'applicable_products' => $promo->applicable_products ?: [],
            'min_order_amount' => (float) $promo->min_order_amount,
            'max_discount_amount' => $promo->max_discount_amount !== null ? (float) $promo->max_discount_amount : null,
            'usage_limit' => $promo->usage_limit,
            'per_customer_limit' => $promo->per_customer_limit,
            'times_used' => (int) $promo->times_used,
            'created_at' => $promo->created_at?->toISOString(),
            'updated_at' => $promo->updated_at?->toISOString(),
        ];
    }

    private function validatePromoDateYears(LaravelValidator $validator, Request $request): void
    {
        $currentYear = now('Asia/Manila')->year;
        foreach (['start_date', 'end_date'] as $field) {
            if (! $request->filled($field) || $validator->errors()->has($field)) {
                continue;
            }

            if (Carbon::parse($request->input($field), 'Asia/Manila')->year > $currentYear) {
                $validator->errors()->add($field, "Promo dates cannot be later than {$currentYear}.");
            }
        }
    }

    private function decodeJsonInputs(Request $request): void
    {
        foreach (['applicable_categories', 'applicable_products'] as $key) {
            $value = $request->input($key);
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                if (is_array($decoded)) {
                    $request->merge([$key => $decoded]);
                }
            }
        }
    }
}
