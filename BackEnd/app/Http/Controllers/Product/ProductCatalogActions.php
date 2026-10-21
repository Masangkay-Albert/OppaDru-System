<?php

namespace App\Http\Controllers\Product;

use App\Models\Franchise;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use Illuminate\Http\Request;

trait ProductCatalogActions
{
    public function index()
    {
        try {
            return response()->json($this->productQuery()->get());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            return response()->json(Product::with(['addonGroups.addons'])->findOrFail($id));
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

        return response()->json(
            $this->productQuery()->whereNull('franchise_id')->where('is_available', true)->get()
        );
    }

    public function getByCategory($category)
    {
        try {
            return response()->json(Product::where('category', $category)->orderBy('name', 'asc')->get());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
