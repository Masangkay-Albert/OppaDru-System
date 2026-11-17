<?php

namespace App\Http\Controllers\Product;

use App\Models\Product;
use App\Models\FranchiseInventory;
use App\Services\FranchiseInventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait ProductFranchiseActions
{
    public function franchiseIndex(Request $request)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json($this->franchiseProductQuery($request)->get());
    }

    public function franchiseArchivedIndex(Request $request, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $ownedProducts = Product::withTrashed()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->whereNotNull('deleted_at')
            ->withCatalogColumns()
            ->orderBy('category')
            ->orderBy('name')
            ->get();
        $sharedProducts = $inventoryService->catalog((string) $franchiseUser->franchise_id, false, true)
            ->where('branch_archived', true)
            ->where('branch_hidden', false)
            ->where('franchise_id', null)
            ->values();

        return response()->json(['data' => $ownedProducts->concat($sharedProducts)->values()]);
    }

    public function franchiseArchive(Request $request, string $id, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::withTrashed()->where(function ($query) use ($franchiseUser) {
            $query->whereNull('franchise_id')
                ->orWhere('franchise_id', $franchiseUser->franchise_id);
        })->findOrFail($id);
        if ($product->franchise_id === null) {
            $inventoryService->update((string) $franchiseUser->franchise_id, $id, ['is_archived' => true]);
            return response()->json(['message' => 'Product archived for this branch.']);
        }
        if (! $product->trashed()) {
            $product->delete();
        }

        return response()->json(['message' => 'Branch product archived successfully.']);
    }

    public function franchiseRestore(Request $request, string $id, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::withTrashed()->where(function ($query) use ($franchiseUser) {
            $query->whereNull('franchise_id')
                ->orWhere('franchise_id', $franchiseUser->franchise_id);
        })->findOrFail($id);
        if ($product->franchise_id === null) {
            $inventoryService->update((string) $franchiseUser->franchise_id, $id, ['is_archived' => false]);
            return response()->json(['product' => $product, 'message' => 'Product restored for this branch.']);
        }
        if ($product->trashed()) {
            $product->restore();
        }

        return response()->json(['product' => $product, 'message' => 'Branch product restored successfully.']);
    }

    public function franchiseStore(Request $request, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $payload = $request->except('franchise_id');
        $payload['franchise_id'] = $franchiseUser->franchise_id;
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
            'franchise_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $product = DB::transaction(function () use ($request, $franchiseUser, $payload, $inventoryService) {
                $product = Product::create([
                    'id' => 'PROD-'.Str::random(8).'-'.strtoupper(Str::random(4)),
                    'franchise_id' => $franchiseUser->franchise_id,
                    'name' => $request->name,
                    'description' => $request->description,
                    'price' => $request->price,
                    'category' => $request->category,
                    'image' => $payload['image'],
                    'is_available' => $request->boolean('is_available', true),
                ]);

                $inventoryService->update(
                    (string) $franchiseUser->franchise_id,
                    (string) $product->id,
                    ['is_available' => $product->is_available]
                );

                return $product;
            });
        } catch (QueryException $exception) {
            Log::warning('Franchise product creation failed.', [
                'franchise_id' => $franchiseUser->franchise_id,
                'product_name' => $request->input('name'),
                'exception' => $exception->getMessage(),
            ]);

            if ($this->isProductNameConstraintViolation($exception)) {
                return response()->json([
                    'message' => 'A product with this name already exists in this branch.',
                ], 409);
            }

            throw $exception;
        }

        return response()->json(['product' => $product, 'message' => 'Franchise product created successfully!'], 201);
    }

    private function isProductNameConstraintViolation(QueryException $exception): bool
    {
        return str_contains($exception->getMessage(), 'products_name_unique_ci')
            || str_contains($exception->getMessage(), 'products_branch_name_unique_ci');
    }

    public function franchiseUploadImage(Request $request)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser || ! $franchiseUser->franchise_id) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|max:5120',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $uploadedImage = $this->imageUploadService->uploadFromRequest(
                $request->file('image'),
                'products/franchise/'.$franchiseUser->franchise_id
            );
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        }

        return response()->json($uploadedImage);
    }

    public function franchiseUpdate(Request $request, string $id, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where(function ($query) use ($franchiseUser) {
            $query->whereNull('franchise_id')
                ->orWhere('franchise_id', $franchiseUser->franchise_id);
        })->findOrFail($id);
        $payload = $request->except('franchise_id');

        if ($request->has('image')) {
            $payload['image'] = $this->normalizeProductImage($request->input('image'));
        }

        $currentValues = [
            'name' => $product->name,
            'description' => $product->description,
            'price' => $product->price,
        ];
        if ($product->franchise_id === null) {
            $branchInventory = FranchiseInventory::query()
                ->where('franchise_id', $franchiseUser->franchise_id)
                ->where('product_id', $product->id)
                ->first();
            $currentValues = [
                'name' => $branchInventory?->branch_name ?? $product->name,
                'description' => $branchInventory?->branch_description ?? $product->description,
                'price' => $branchInventory?->branch_price ?? $product->price,
            ];
        }
        $requestedName = $request->input('name');
        $nameUnchanged = $request->exists('name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $currentValues['name']);
        $requestedDescription = $request->input('description');
        $descriptionUnchanged = $request->exists('description')
            && is_string($requestedDescription)
            && trim($requestedDescription) === trim((string) $currentValues['description']);
        $requestedPrice = (string) $request->input('price');
        $priceUnchanged = $request->exists('price')
            && preg_match('/^\d+(?:\.\d{1,2})?$/', $requestedPrice) === 1
            && bccomp($requestedPrice, (string) $currentValues['price'], 2) === 0;
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
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $payload = $validator->validated();
        if ($nameUnchanged) {
            unset($payload['name']);
        }
        if ($descriptionUnchanged) {
            unset($payload['description']);
        }
        if ($priceUnchanged) {
            unset($payload['price']);
        }

        if ($product->franchise_id === null) {
            $branchChanges = [];
            foreach (['name' => 'branch_name', 'description' => 'branch_description', 'price' => 'branch_price', 'category' => 'branch_category', 'image' => 'branch_image'] as $field => $column) {
                if (array_key_exists($field, $payload)) {
                    $branchChanges[$column] = $payload[$field];
                }
            }
            if (array_key_exists('is_available', $payload)) {
                $branchChanges['is_available'] = (bool) $payload['is_available'];
            }
            if ($branchChanges) {
                $inventoryService->update((string) $franchiseUser->franchise_id, $id, $branchChanges);
            }

            return response()->json(['product' => $product, 'message' => 'Product updated for this branch only.']);
        }

        $product->update($payload);

        return response()->json(['product' => $product, 'message' => 'Franchise product updated successfully!']);
    }

    public function franchiseDestroy(Request $request, string $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::withTrashed()->where(function ($query) use ($franchiseUser) {
            $query->whereNull('franchise_id')
                ->orWhere('franchise_id', $franchiseUser->franchise_id);
        })->findOrFail($id);

        if ($product->franchise_id === null) {
            $inventory = FranchiseInventory::where('franchise_id', $franchiseUser->franchise_id)
                ->where('product_id', $product->id)
                ->firstOrFail();
            if (! $inventory->is_archived) {
                return response()->json(['message' => 'Archive this branch product before permanently removing it.'], 409);
            }
            $inventory->fill([
                'is_archived' => false,
                'is_hidden' => true,
                'branch_name' => null,
                'branch_description' => null,
                'branch_price' => null,
                'branch_category' => null,
                'branch_image' => null,
            ])->save();
            Product::clearCatalogCache();

            return response()->json(['message' => 'Product removed from this branch.']);
        }

        if (! $product->trashed()) {
            $product->delete();

            return response()->json(['message' => 'Branch product archived successfully.']);
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
            Log::warning('Archived branch product could not be permanently deleted because it is still referenced.', [
                'product_id' => $product->id,
                'franchise_id' => $product->franchise_id,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'This archived product is still referenced by system records and cannot be permanently deleted.',
            ], 409);
        }

        return response()->json(['message' => 'Archived branch product permanently deleted.']);
    }

    public function franchiseToggleAvailability(Request $request, string $id, FranchiseInventoryService $inventoryService)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where(function ($query) use ($franchiseUser) {
            $query->whereNull('franchise_id')
                ->orWhere('franchise_id', $franchiseUser->franchise_id);
        })->findOrFail($id);
        if ($product->franchise_id === null) {
            $inventory = FranchiseInventory::where('franchise_id', $franchiseUser->franchise_id)
                ->where('product_id', $id)
                ->firstOrFail();
            $inventoryService->update((string) $franchiseUser->franchise_id, $id, [
                'is_available' => ! $inventory->is_available,
            ]);

            return response()->json(['message' => 'Branch product availability updated.']);
        }
        $product->is_available = ! $product->is_available;
        $product->save();

        return response()->json(['product' => $product, 'message' => 'Franchise product availability toggled!']);
    }
}
