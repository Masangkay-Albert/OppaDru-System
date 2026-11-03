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

    public function franchiseArchivedIndex(Request $request)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $products = Product::withTrashed()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->whereNotNull('deleted_at')
            ->withCatalogColumns()
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $products]);
    }

    public function franchiseArchive(Request $request, string $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::withTrashed()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->findOrFail($id);
        if (! $product->trashed()) {
            $product->delete();
        }

        return response()->json(['message' => 'Branch product archived successfully.']);
    }

    public function franchiseRestore(Request $request, string $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::withTrashed()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->findOrFail($id);
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
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0.01',
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

    public function franchiseUpdate(Request $request, string $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where('franchise_id', $franchiseUser->franchise_id)->findOrFail($id);
        $payload = $request->except('franchise_id');

        if ($request->has('image')) {
            $payload['image'] = $this->normalizeProductImage($request->input('image'));
        }

        $validator = Validator::make($payload, [
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0.01',
            'category' => 'sometimes|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
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

        $product = Product::withTrashed()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->findOrFail($id);

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

    public function franchiseToggleAvailability(Request $request, string $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where('franchise_id', $franchiseUser->franchise_id)->findOrFail($id);
        $product->is_available = ! $product->is_available;
        $product->save();

        return response()->json(['product' => $product, 'message' => 'Franchise product availability toggled!']);
    }
}
