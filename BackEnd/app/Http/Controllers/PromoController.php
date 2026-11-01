<?php

namespace App\Http\Controllers;

use App\Models\Promo;
use App\Support\DatabaseImage;
use App\Support\HttpCacheResponse;
use App\Traits\AdminAuthTrait;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator as LaravelValidator;

class PromoController extends Controller
{
    use AdminAuthTrait;
    use HttpCacheResponse;

    public function index(Request $request)
    {
        $promos = Cache::remember('promos_active_list', 600, function () {
            return Promo::active()->orderBy('created_at', 'desc')->get()->map(fn (Promo $promo) => $this->formatPromo($promo))->values();
        });

        return $this->cachedJsonResponse($request, $promos, 300);
    }

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

    public function store(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $this->decodeJsonInputs($request);

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'code' => 'nullable|string|max:50|unique:promos,code',
            'channel' => 'sometimes|in:all,online,onsite',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0.01',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|file|image|mimes:jpeg,jpg,png,webp|max:5120',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_discount_amount' => 'nullable|numeric|min:0',
            'usage_limit' => 'nullable|integer|min:1',
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
        $promo = Promo::where('id', $id)->orWhere('code', strtoupper($id))->firstOrFail();

        return response()->json($this->formatPromo($promo));
    }

    public function image(string $id)
    {
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

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'code' => 'nullable|string|max:50|unique:promos,code,' . $promo->id . ',id',
            'channel' => 'sometimes|required|in:all,online,onsite',
            'discount_type' => 'sometimes|required|in:percent,fixed',
            'discount_value' => 'sometimes|required|numeric|min:0.01',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|file|image|mimes:jpeg,jpg,png,webp|max:5120',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_discount_amount' => 'nullable|numeric|min:0',
            'usage_limit' => 'nullable|integer|min:1',
        ]);
        $validator->after(fn (LaravelValidator $validator) => $this->validatePromoDateYears($validator, $request));

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

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

    public function validatePromo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
            'subtotal' => 'required|numeric|min:0',
            'items' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $code = strtoupper(trim((string) $request->code));
        $subtotal = (float) $request->subtotal;
        $items = (array) $request->input('items', []);

        $promo = Promo::where('code', $code)->first();

        if (!$promo) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => 'Invalid promo code.',
            ], 200);
        }

        if (!$promo->is_active) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => 'This promo is currently inactive.',
            ], 200);
        }

        if ($promo->start_date && $promo->start_date->isFuture()) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => 'This promo has not started yet.',
            ], 200);
        }

        if ($promo->end_date && $promo->end_date->isPast()) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => 'This promo has expired.',
            ], 200);
        }

        if ($subtotal < (float) $promo->min_order_amount) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => "Minimum order of ₱" . number_format((float) $promo->min_order_amount, 2) . " required.",
            ], 200);
        }

        $discount = $promo->calculateDiscount($subtotal, $items);

        if ($discount <= 0) {
            return response()->json([
                'isValid' => false,
                'discount' => 0,
                'message' => 'This promo does not apply to the selected items.',
            ], 200);
        }

        return response()->json([
            'isValid' => true,
            'discount' => $discount,
            'promo' => $this->formatPromo($promo),
            'message' => 'Promo applied successfully!',
        ], 200);
    }

    private function formatPromo(Promo $promo): array
    {
        $image = $promo->getRawOriginal('image');
        $imageUrl = null;
        if (is_string($image) && $image !== '') {
            if (str_starts_with($image, 'data:image/')) {
                $version = substr(hash('sha256', $image), 0, 16);
                $imageUrl = url('/api/promos/'.$promo->id.'/image').'?v='.$version;
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
