<?php

namespace App\Services;

use App\Models\FranchiseInventory;
use App\Models\Product;
use Illuminate\Support\Collection;

class FranchiseInventoryService
{
    public function initializeBranchMenu(string $franchiseId): void
    {
        $products = Product::where(function ($query) use ($franchiseId) {
            $query->whereNull('franchise_id')->orWhere('franchise_id', $franchiseId);
        })->get(['id', 'is_available']);

        if ($products->isEmpty()) {
            return;
        }

        $now = now();
        FranchiseInventory::query()->insertOrIgnore($products->map(fn (Product $product) => [
            'franchise_id' => $franchiseId,
            'product_id' => $product->id,
            'stock_quantity' => null,
            'is_available' => $product->is_available,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());
    }

    public function catalog(string $franchiseId, bool $availableOnly = false): Collection
    {
        $this->initializeBranchMenu($franchiseId);

        $products = Product::where(function ($query) use ($franchiseId) {
            $query->whereNull('franchise_id')->orWhere('franchise_id', $franchiseId);
        })->orderBy('category')->orderBy('name')->get();

        $inventory = FranchiseInventory::where('franchise_id', $franchiseId)
            ->whereIn('product_id', $products->pluck('id'))
            ->get()
            ->keyBy('product_id');
        $hasBranchInventory = $inventory->isNotEmpty();

        $catalog = $products->map(function (Product $product) use ($inventory, $hasBranchInventory) {
            $stock = $inventory->get($product->id);
            $stockQuantity = $stock?->stock_quantity;
            $branchAvailable = (bool) ($stock?->is_available ?? ($hasBranchInventory && $product->is_available))
                && ($stockQuantity === null || $stockQuantity > 0);

            return array_merge($product->toArray(), [
                'branch_stock' => $stockQuantity,
                'branch_stock_tracked' => $stock !== null && $stockQuantity !== null,
                'branch_enabled' => (bool) ($stock?->is_available ?? ($hasBranchInventory && $product->is_available)),
                'branch_available' => $branchAvailable,
                'low_stock' => $stockQuantity !== null && $stockQuantity > 0 && $stockQuantity <= 5,
            ]);
        });

        return $availableOnly ? $catalog->where('branch_available', true)->values() : $catalog;
    }

    public function update(string $franchiseId, string $productId, array $values): FranchiseInventory
    {
        $product = Product::where(function ($query) use ($franchiseId) {
            $query->whereNull('franchise_id')->orWhere('franchise_id', $franchiseId);
        })->findOrFail($productId);

        $inventory = FranchiseInventory::firstOrNew([
            'franchise_id' => $franchiseId,
            'product_id' => $product->id,
        ]);
        $inventory->fill($values);
        $inventory->save();

        return $inventory;
    }

    public function consume(string $franchiseId, array $items): void
    {
        $quantities = collect($items)->groupBy('product_id')->map(
            fn (Collection $productItems) => $productItems->sum(fn (array $item) => (int) $item['quantity'])
        );

        foreach ($quantities as $productId => $quantity) {
            $inventory = FranchiseInventory::where('franchise_id', $franchiseId)
                ->where('product_id', $productId)
                ->lockForUpdate()
                ->first();

            if (!$inventory) {
                continue;
            }
            if (!$inventory->is_available) {
                throw new \InvalidArgumentException('One or more items are unavailable at this branch.');
            }
            if ($inventory->stock_quantity !== null) {
                if ($inventory->stock_quantity < $quantity) {
                    throw new \InvalidArgumentException('There is not enough branch stock to complete this order.');
                }
                $inventory->stock_quantity -= $quantity;
                $inventory->save();
            }
        }
    }
}
