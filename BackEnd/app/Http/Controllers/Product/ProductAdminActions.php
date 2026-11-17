<?php

namespace App\Http\Controllers\Product;

use App\Models\Product;
use App\Services\FranchiseInventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait ProductAdminActions
{
    public function count(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json(['count' => Product::count()]);
    }

    public function getAllForAdmin(Request $request, FranchiseInventoryService $inventoryService)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $products = $this->productQuery()->get();
        $unavailableIds = array_fill_keys(
            $inventoryService->globalProductsUnavailableInAnyBranch(
                $products->whereNull('franchise_id')->pluck('id')->all()
            ),
            true
        );
        $products->each(static function (Product $product) use ($unavailableIds): void {
            if ($product->franchise_id === null) {
                $product->setAttribute(
                    'global_visible_to_all_branches',
                    ! isset($unavailableIds[(string) $product->id])
                );
            }
        });

        return response()->json(['data' => $products]);
    }

    public function getArchivedForAdmin(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $products = Product::withTrashed()
            ->whereNotNull('deleted_at')
            ->withCatalogColumns()
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $products]);
    }

    public function archive(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::withTrashed()->findOrFail($id);
        if (!$product->trashed()) {
            $product->delete();
        }

        return response()->json(['message' => 'Product archived successfully.']);
    }

    public function restore(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::withTrashed()->findOrFail($id);
        if ($product->trashed()) {
            $product->restore();
        }

        return response()->json(['product' => $product, 'message' => 'Product restored successfully.']);
    }

    public function uploadImage(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|file|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'folder' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'The image upload is invalid.', 'errors' => $validator->errors()], 422);
        }

        try {
            $file = $request->file('image');
            if (! $file || ! $file->isValid()) {
                return response()->json(['message' => 'Invalid image upload.'], 400);
            }

            $result = $this->imageUploadService->uploadFromRequest($file, (string) $request->input('folder', 'products'));

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Image upload failed. Please try again.',
            ], 500);
        }
    }

    public function store(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = $request->all();
        $payload['image'] = $this->normalizeProductImage($request->input('image'));

        $validator = Validator::make($payload, [
            'name' => [
                'required',
                'string',
                'min:'.config('input_limits.product_name.min'),
                'max:'.config('input_limits.product_name.max'),
                'regex:'.config('input_limits.product_name.pattern'),
            ],
            'description' => 'required|string|max:'.config('input_limits.short_description'),
            'price' => ['required', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0.01', 'max:'.config('input_limits.amount')],
            'category' => 'required|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
            'franchise_id' => 'present|nullable|string|exists:franchises,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payload = $validator->validated();
        $name = trim((string) $payload['name']);
        $normalizedName = strtolower(preg_replace('/\s+/', ' ', $name));
        $product = Product::query()
            ->where(function ($query) use ($payload) {
                if ($payload['franchise_id'] === null) {
                    $query->whereNull('franchise_id');
                } else {
                    $query->where('franchise_id', $payload['franchise_id']);
                }
            })
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])
            ->first();

        if ($product) {
            $product->update($payload);
        } else {
            $payload['id'] = 'PROD-'.Str::random(8).'-'.strtoupper(Str::random(4));
            $product = Product::create($payload);
        }

        return response()->json(['product' => $product, 'message' => 'Product created/updated successfully!'], 201);
    }

    public function update(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::findOrFail($id);
        $payload = $request->all();

        if ($request->has('image')) {
            $payload['image'] = $this->normalizeProductImage($request->input('image'));
        }

        $requestedName = $request->input('name');
        $nameUnchanged = $request->exists('name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $product->name);
        $requestedDescription = $request->input('description');
        $descriptionUnchanged = $request->exists('description')
            && is_string($requestedDescription)
            && trim($requestedDescription) === trim((string) $product->description);
        $requestedPrice = (string) $request->input('price');
        $priceUnchanged = $request->exists('price')
            && preg_match('/^\d+(?:\.\d{1,2})?$/', $requestedPrice) === 1
            && bccomp($requestedPrice, (string) $product->getRawOriginal('price'), 2) === 0;
        $nameRules = ['sometimes', 'string'];
        if ($request->exists('name') && ! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.product_name.min'),
                'max:'.config('input_limits.product_name.max'),
                'regex:'.config('input_limits.product_name.pattern'),
            ];
        }
        $descriptionRules = ['sometimes', 'string'];
        if ($request->exists('description') && ! $descriptionUnchanged) {
            $descriptionRules[] = 'max:'.config('input_limits.short_description');
        }
        $priceRules = ['sometimes', 'numeric'];
        if ($request->exists('price') && ! $priceUnchanged) {
            $priceRules = [...$priceRules, 'regex:/^\d+(?:\.\d{1,2})?$/', 'min:0.01', 'max:'.config('input_limits.amount')];
        }
        $validator = Validator::make($payload, [
            'name' => $nameRules,
            'description' => $descriptionRules,
            'price' => $priceRules,
            'category' => 'sometimes|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
            'franchise_id' => 'sometimes|nullable|string|exists:franchises,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payload = $validator->validated();
        if ($nameUnchanged) {
            $payload['name'] = $product->getRawOriginal('name');
        }
        if ($descriptionUnchanged) {
            $payload['description'] = $product->getRawOriginal('description');
        }
        if ($priceUnchanged) {
            $payload['price'] = $product->getRawOriginal('price');
        }
        $product->update($payload);

        return response()->json(['product' => $product, 'message' => 'Product updated successfully!']);
    }

    public function destroy(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::withTrashed()->findOrFail($id);
        if (! $product->trashed()) {
            $product->delete();

            return response()->json(['message' => 'Product archived successfully.']);
        }

        try {
            DB::transaction(function () use ($product) {
                if (Schema::hasTable('product_addon_groups')) {
                    DB::table('product_addon_groups')->where('product_id', $product->id)->delete();
                }
                if (Schema::hasTable('franchise_inventory')) {
                    DB::table('franchise_inventory')->where('product_id', $product->id)->delete();
                }
                if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'product_id')) {
                    DB::table('order_items')
                        ->where('product_id', $product->id)
                        ->update(['product_id' => null]);
                }

                $product->forceDelete();
            });
        } catch (QueryException $exception) {
            Log::warning('Archived product could not be permanently deleted because it is still referenced.', [
                'product_id' => $product->id,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'This archived product is still referenced by system records and cannot be permanently deleted.',
            ], 409);
        }

        return response()->json(['message' => 'Archived product permanently deleted.']);
    }

    public function toggleAvailability(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::findOrFail($id);
        $product->is_available = ! $product->is_available;
        $product->save();

        return response()->json(['product' => $product, 'message' => 'Product availability toggled!']);
    }
}
