<?php

namespace App\Http\Controllers\Product;

use App\Models\Franchise;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use App\Support\HttpCacheResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

trait ProductCatalogActions
{
    use HttpCacheResponse;

    public function index(Request $request)
    {
        try {
            $products = Cache::remember('catalog_products_all', 600, function () {
                return $this->productQuery()->get();
            });

            return $this->cachedJsonResponse($request, $products, 300);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            $product = Cache::remember("catalog_product_{$id}", 600, function () use ($id) {
                return Product::withCatalogColumns()->with(['addonGroups.addons'])->findOrFail($id);
            });

            return response()->json($product);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }
    }

    public function getAvailable(Request $request, FranchiseInventoryService $inventoryService)
    {
        $franchiseId = $request->query('franchise_id');

        if ($franchiseId !== null) {
            $franchise = Franchise::with('franchiseAccount')->where('id', $franchiseId)->first();
            if (! $franchise) {
                return response()->json(['message' => 'The selected branch is unavailable.'], 404);
            }

            $catalog = $inventoryService->catalog((string) $franchiseId, true)->values();
            if ($catalog->isNotEmpty()) {
                return response()->json($catalog);
            }

            if (! $franchise->isOperationallyActive()) {
                return response()->json(['message' => 'The selected branch is unavailable.'], 404);
            }

            return response()->json($catalog);
        }

        $availableProducts = Cache::remember('catalog_products_available', 600, function () {
            return $this->productQuery()->whereNull('franchise_id')->where('is_available', true)->get();
        });

        return $this->cachedJsonResponse($request, $availableProducts, 300);
    }

    public function getByCategory(Request $request, $category)
    {
        try {
            $categoryClean = strtolower(trim((string)$category));
            $products = Cache::remember("catalog_products_cat_{$categoryClean}", 600, function () use ($categoryClean) {
                return $this->productQuery()->where('category', $categoryClean)->get();
            });

            return $this->cachedJsonResponse($request, $products, 300);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
