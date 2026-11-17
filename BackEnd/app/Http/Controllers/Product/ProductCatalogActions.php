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

    public function index(Request $request, FranchiseInventoryService $inventoryService)
    {
        try {
            $franchiseId = $request->query('franchise_id');
            if ($franchiseId !== null) {
                if (! Franchise::whereKey($franchiseId)->exists()) {
                    return response()->json(['message' => 'The selected branch is unavailable.'], 404);
                }

                return response()->json($inventoryService->catalog((string) $franchiseId))
                    ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
            }

            $products = Cache::remember('catalog_products_global', 600, function () use ($inventoryService) {
                return $inventoryService->filterGlobalCatalog(
                    $this->productQuery()->whereNull('franchise_id')->get()
                );
            });

            return $this->cachedJsonResponse($request, $products, 300);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show(Request $request, string $id, FranchiseInventoryService $inventoryService)
    {
        try {
            $franchiseId = $request->query('franchise_id');
            $loadProduct = fn () => Product::withCatalogColumns()
                ->with(['addonGroups.addons'])
                ->whereKey($id)
                ->where(function ($query) use ($franchiseId) {
                    $query->whereNull('franchise_id');
                    if ($franchiseId !== null) {
                        $query->orWhere('franchise_id', $franchiseId);
                    }
                })
                ->firstOrFail();

            if ($franchiseId !== null && ! Franchise::whereKey($franchiseId)->exists()) {
                return response()->json(['message' => 'Product not found'], 404);
            }

            $product = $loadProduct();
            if ($franchiseId === null
                && in_array(
                    (string) $product->id,
                    $inventoryService->globalProductsUnavailableInAnyBranch([(string) $product->id]),
                    true
                )) {
                return response()->json(['message' => 'Product not found'], 404);
            }
            if ($franchiseId !== null) {
                $branchProduct = $inventoryService->catalog((string) $franchiseId)
                    ->firstWhere('id', $id);
                if (! $branchProduct) {
                    return response()->json(['message' => 'Product not found'], 404);
                }
                $product = array_merge($product->toArray(), $branchProduct);
            }

            return response()->json($product)
                ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
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
                return response()->json($catalog)
                    ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
            }

            if (! $franchise->isOperationallyActive()) {
                return response()->json(['message' => 'The selected branch is unavailable.'], 404)
                    ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
            }

            return response()->json($catalog)
                ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
        }

        $availableProducts = Cache::remember('catalog_products_available', 600, function () use ($inventoryService) {
            return $inventoryService->filterGlobalCatalog(
                $this->productQuery()->whereNull('franchise_id')->where('is_available', true)->get()
            );
        });

        return $this->cachedJsonResponse($request, $availableProducts, 300);
    }

    public function getByCategory(Request $request, string $category, FranchiseInventoryService $inventoryService)
    {
        try {
            $categoryClean = strtolower(trim((string)$category));
            $franchiseId = $request->query('franchise_id');
            if ($franchiseId !== null) {
                if (! Franchise::whereKey($franchiseId)->exists()) {
                    return response()->json(['message' => 'The selected branch is unavailable.'], 404);
                }

                $products = $inventoryService->catalog((string) $franchiseId, true)
                    ->where('category', $categoryClean)
                    ->values();

                return response()->json($products)
                    ->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
            }

            $products = Cache::remember("catalog_products_cat_{$categoryClean}", 600, function () use ($categoryClean, $inventoryService) {
                return $inventoryService->filterGlobalCatalog(
                    $this->productQuery()
                        ->whereNull('franchise_id')
                        ->where('category', $categoryClean)
                        ->get()
                );
            });

            return $this->cachedJsonResponse($request, $products, 300);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
