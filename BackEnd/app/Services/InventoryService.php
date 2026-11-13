<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\BranchIngredientStock;
use App\Models\Franchise;
use App\Models\FranchiseInventory;
use App\Models\MainBranchIngredient;
use App\Models\MainBranchStockMovement;
use App\Models\Order;
use App\Models\StockBatch;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class InventoryService
{
    private const MOVEMENT_TYPES = [
        'stock_in',
        'stock_out',
        'adjustment',
        'waste',
        'order_usage',
        'count_adjustment',
        'opening_stock',
    ];

    public function move(
        int $ingredientId,
        string $type,
        float $quantity,
        ?string $reason = null,
        ?object $actor = null,
        array $metadata = [],
    ): MainBranchStockMovement {
        if (! in_array($type, self::MOVEMENT_TYPES, true)) {
            throw new InvalidArgumentException('The stock movement type is invalid.');
        }
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Enter a quantity greater than zero.');
        }
        if (in_array($type, ['adjustment', 'count_adjustment'], true)) {
            throw new InvalidArgumentException('Use setQuantity for stock counts and adjustments.');
        }

        return DB::transaction(function () use ($ingredientId, $type, $quantity, $reason, $actor, $metadata) {
            $ingredient = MainBranchIngredient::query()->lockForUpdate()->findOrFail($ingredientId);
            $delta = in_array($type, ['stock_out', 'waste', 'order_usage'], true)
                ? -$quantity
                : $quantity;

            return $this->applyDelta($ingredient, $delta, $type, $reason, $actor, $metadata);
        }, 3);
    }

    public function setQuantity(
        int $ingredientId,
        float $targetQuantity,
        string $type,
        ?string $reason,
        ?object $actor = null,
        array $metadata = [],
    ): ?MainBranchStockMovement {
        if (! in_array($type, ['adjustment', 'count_adjustment'], true)) {
            throw new InvalidArgumentException('The stock adjustment type is invalid.');
        }
        if ($targetQuantity < 0) {
            throw new InvalidArgumentException('Stock cannot be negative.');
        }
        if (in_array($type, ['adjustment', 'count_adjustment'], true) && trim((string) $reason) === '') {
            throw new InvalidArgumentException('A reason is required for stock adjustments.');
        }

        return DB::transaction(function () use ($ingredientId, $targetQuantity, $type, $reason, $actor, $metadata) {
            $ingredient = MainBranchIngredient::query()->lockForUpdate()->findOrFail($ingredientId);
            $target = round($targetQuantity, 3);
            $delta = round($target - (float) $ingredient->quantity, 3);

            if ($delta === 0.0) {
                return null;
            }

            return $this->applyDelta($ingredient, $delta, $type, $reason, $actor, $metadata);
        }, 3);
    }

    public function receive(
        int $ingredientId,
        float $purchaseQuantity,
        float $purchaseUnitCost,
        ?string $reason,
        ?object $actor = null,
        array $metadata = [],
    ): MainBranchStockMovement {
        if ($purchaseQuantity <= 0 || $purchaseUnitCost < 0) {
            throw new InvalidArgumentException('Received quantity must be positive and unit cost cannot be negative.');
        }

        return DB::transaction(function () use ($ingredientId, $purchaseQuantity, $purchaseUnitCost, $reason, $actor, $metadata) {
            $ingredient = MainBranchIngredient::query()->lockForUpdate()->findOrFail($ingredientId);
            if ($ingredient->is_archived) {
                throw new InvalidArgumentException('Archived ingredients cannot be received.');
            }

            $factor = (float) $ingredient->conversion_factor;
            if ($factor <= 0) {
                throw new InvalidArgumentException('The purchase-to-usage conversion factor must be greater than zero.');
            }
            $usageQuantity = round($purchaseQuantity * $factor, 3);
            if ($usageQuantity <= 0) {
                throw new InvalidArgumentException('The received quantity is too small for this ingredient unit.');
            }
            $usageUnitCost = round($purchaseUnitCost / $factor, 4);
            $oldQuantity = (float) $ingredient->quantity;
            $oldCost = (float) ($ingredient->unit_cost ?? 0);
            $newQuantity = round($oldQuantity + $usageQuantity, 3);
            $ingredient->unit_cost = $newQuantity > 0
                ? round((($oldQuantity * $oldCost) + ($usageQuantity * $usageUnitCost)) / $newQuantity, 2)
                : round($usageUnitCost, 2);

            $movement = $this->applyDelta($ingredient, $usageQuantity, 'stock_in', $reason, $actor, [
                ...$metadata,
                'unit_cost' => $usageUnitCost,
                'purchase_quantity' => round($purchaseQuantity, 3),
                'purchase_unit' => $ingredient->purchase_unit ?: $ingredient->unit,
            ]);

            $ingredient->save();

            return $movement;
        }, 3);
    }

    public function moveBranch(
        string $branchId,
        int $ingredientId,
        string $type,
        float $quantity,
        ?string $reason = null,
        ?object $actor = null,
        array $metadata = [],
    ): MainBranchStockMovement {
        if (! in_array($type, self::MOVEMENT_TYPES, true) || in_array($type, ['adjustment', 'count_adjustment'], true)) {
            throw new InvalidArgumentException('The stock movement type is invalid.');
        }
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Enter a quantity greater than zero.');
        }

        return DB::transaction(function () use ($branchId, $ingredientId, $type, $quantity, $reason, $actor, $metadata) {
            $ingredient = MainBranchIngredient::query()->findOrFail($ingredientId);
            $stock = BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredientId)
                ->lockForUpdate()
                ->first();
            if (! $stock && ! in_array($type, ['stock_in', 'opening_stock'], true)) {
                throw new InvalidArgumentException('This ingredient has no stock recorded for the branch.');
            }
            $stock ??= BranchIngredientStock::create([
                'branch_id' => $branchId,
                'ingredient_id' => $ingredientId,
                'quantity' => 0,
                'reorder_level' => $ingredient->reorder_level,
                'unit_cost' => $ingredient->unit_cost,
            ]);

            $delta = in_array($type, ['stock_out', 'waste', 'order_usage'], true)
                ? -$quantity
                : $quantity;

            return $this->applyBranchDelta($ingredient, $stock, $delta, $type, $reason, $actor, $metadata);
        }, 3);
    }

    public function setBranchQuantity(
        string $branchId,
        int $ingredientId,
        float $targetQuantity,
        string $type,
        string $reason,
        ?object $actor = null,
        array $metadata = [],
    ): ?MainBranchStockMovement {
        if (! in_array($type, ['adjustment', 'count_adjustment'], true) || $targetQuantity < 0 || trim($reason) === '') {
            throw new InvalidArgumentException('A valid non-negative quantity and reason are required.');
        }

        return DB::transaction(function () use ($branchId, $ingredientId, $targetQuantity, $type, $reason, $actor, $metadata) {
            $ingredient = MainBranchIngredient::query()->findOrFail($ingredientId);
            $stock = BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredientId)
                ->lockForUpdate()
                ->firstOrFail();
            $delta = round(round($targetQuantity, 3) - (float) $stock->quantity, 3);
            if ($delta === 0.0) {
                return null;
            }

            return $this->applyBranchDelta($ingredient, $stock, $delta, $type, $reason, $actor, $metadata);
        }, 3);
    }

    public function transferToBranch(
        string $destinationBranchId,
        int $ingredientId,
        float $quantity,
        ?object $actor = null,
        ?string $reason = null,
    ): MainBranchStockMovement {
        return DB::transaction(function () use ($destinationBranchId, $ingredientId, $quantity, $actor, $reason) {
            $dispatch = $this->dispatchToBranch(
                $ingredientId,
                $quantity,
                $actor,
                $reason ?? 'Transfer to branch '.$destinationBranchId,
            );

            return $this->receiveTransferItem(
                $destinationBranchId,
                $ingredientId,
                $quantity,
                $dispatch['movement']->unit_cost,
                $dispatch['batch_lots'],
                $actor,
                $reason ?? 'Transfer from main branch',
            );
        }, 3);
    }

    public function dispatchToBranch(
        int $ingredientId,
        float $quantity,
        ?object $actor = null,
        ?string $reason = null,
    ): array {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Enter a quantity greater than zero.');
        }

        return DB::transaction(function () use ($ingredientId, $quantity, $actor, $reason) {
            $ingredient = MainBranchIngredient::query()->lockForUpdate()->findOrFail($ingredientId);
            if ($quantity > $this->availableQuantity($ingredientId)) {
                throw new InvalidArgumentException('There is not enough unexpired stock available for this transfer.');
            }
            $lots = $this->batchLots(null, $ingredientId, $quantity);
            $movement = $this->move(
                $ingredientId,
                'stock_out',
                $quantity,
                $reason ?? 'Transfer to branch',
                $actor,
                ['exclude_expired' => true],
            );

            return ['movement' => $movement, 'batch_lots' => $lots];
        }, 3);
    }

    public function receiveTransferItem(
        string $branchId,
        int $ingredientId,
        float $quantity,
        ?float $unitCost,
        array $batchLots,
        ?object $actor = null,
        ?string $reason = null,
    ): MainBranchStockMovement {
        return $this->moveBranch(
            $branchId,
            $ingredientId,
            'stock_in',
            $quantity,
            $reason ?? 'Stock transfer received',
            $actor,
            ['unit_cost' => $unitCost, 'batch_lots' => $batchLots],
        );
    }

    public function deductForOrder(Order $order): void
    {
        if (! $order->branch_id) {
            return;
        }
        $mainBranch = $this->isMainBranchOrder($order);

        DB::transaction(function () use ($order, $mainBranch) {
            $requirements = [];
            foreach ((array) $order->items as $item) {
                $productId = $item['product_id'] ?? null;
                $servings = (int) ($item['quantity'] ?? 0);
                if (! $productId || $servings < 1) {
                    continue;
                }

                foreach (DB::table('ingredient_recipes')->where('product_id', $productId)->get() as $recipe) {
                    $requirements[$recipe->ingredient_id] = ($requirements[$recipe->ingredient_id] ?? 0)
                        + ((float) $recipe->quantity * $servings);
                }
            }

            ksort($requirements);
            foreach ($requirements as $ingredientId => $quantity) {
                $deductionsTable = $mainBranch ? 'order_ingredient_deductions' : 'branch_order_ingredient_deductions';
                $existingQuery = DB::table($deductionsTable)
                    ->where('order_id', $order->id)
                    ->where('ingredient_id', $ingredientId);
                if (! $mainBranch) {
                    $existingQuery->where('branch_id', $order->branch_id);
                }
                $existing = $existingQuery->lockForUpdate()->first();
                if ($existing) {
                    continue;
                }

                $quantity = round((float) $quantity, 3);
                if ($quantity <= 0) {
                    continue;
                }
                $movement = $mainBranch
                    ? $this->move(
                        (int) $ingredientId,
                        'order_usage',
                        $quantity,
                        'Ingredient usage for order '.$order->order_number,
                        null,
                        ['order_id' => $order->id],
                    )
                    : $this->moveBranch(
                        (string) $order->branch_id,
                        (int) $ingredientId,
                        'order_usage',
                        $quantity,
                        'Ingredient usage for order '.$order->order_number,
                        null,
                        ['order_id' => $order->id],
                    );
                DB::table($deductionsTable)->insert([
                    'order_id' => $order->id,
                    ...(! $mainBranch ? ['branch_id' => $order->branch_id] : []),
                    'ingredient_id' => $ingredientId,
                    'quantity' => $quantity,
                    'movement_id' => $movement->id,
                    'is_reversed' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }, 3);
    }

    public function reverseOrder(Order $order, ?object $actor = null): void
    {
        if (! $order->branch_id) {
            return;
        }
        $mainBranch = $this->isMainBranchOrder($order);

        DB::transaction(function () use ($order, $actor, $mainBranch) {
            $deductionsTable = $mainBranch ? 'order_ingredient_deductions' : 'branch_order_ingredient_deductions';
            $deductionsQuery = DB::table($deductionsTable)
                ->where('order_id', $order->id)
                ->where('is_reversed', false)
                ->orderBy('ingredient_id')
                ->lockForUpdate();
            if (! $mainBranch) {
                $deductionsQuery->where('branch_id', $order->branch_id);
            }
            $deductions = $deductionsQuery->get();

            foreach ($deductions as $deduction) {
                if ($mainBranch) {
                    $ingredient = MainBranchIngredient::query()->findOrFail((int) $deduction->ingredient_id);
                    $movement = $this->setQuantity(
                        (int) $deduction->ingredient_id,
                        round((float) $ingredient->quantity + (float) $deduction->quantity, 3),
                        'adjustment',
                        'Reversal of ingredient usage for order '.$order->order_number,
                        $actor,
                        [
                            'order_id' => $order->id,
                            'restore_batches_from_movement_id' => $deduction->movement_id,
                        ],
                    );
                } else {
                    $stock = BranchIngredientStock::query()
                        ->where('branch_id', $order->branch_id)
                        ->where('ingredient_id', $deduction->ingredient_id)
                        ->firstOrFail();
                    $movement = $this->setBranchQuantity(
                        (string) $order->branch_id,
                        (int) $deduction->ingredient_id,
                        round((float) $stock->quantity + (float) $deduction->quantity, 3),
                        'adjustment',
                        'Reversal of ingredient usage for order '.$order->order_number,
                        $actor,
                        ['restore_batches_from_movement_id' => $deduction->movement_id],
                    );
                }
                if (! $movement) {
                    continue;
                }
                DB::table($deductionsTable)->where('id', $deduction->id)->update([
                    'is_reversed' => true,
                    'reversal_movement_id' => $movement->id,
                    'updated_at' => now(),
                ]);
            }
        }, 3);
    }

    public function availablePortions(string $productId, ?string $branchId = null): ?int
    {
        $usesMainStock = $branchId === null
            || Franchise::query()->whereKey($branchId)->where('is_main', true)->exists();
        $recipes = DB::table('ingredient_recipes')
            ->join('main_branch_ingredients', 'ingredient_recipes.ingredient_id', '=', 'main_branch_ingredients.id')
            ->where('ingredient_recipes.product_id', $productId)
            ->where('main_branch_ingredients.is_archived', false)
            ->get([
                'ingredient_recipes.ingredient_id',
                'ingredient_recipes.quantity as recipe_quantity',
                'main_branch_ingredients.quantity as stock_quantity',
            ]);

        if ($recipes->isEmpty()) {
            return null;
        }

        return (int) $recipes->min(function ($recipe) use ($branchId, $usesMainStock) {
            $stockQuantity = $this->availableQuantity((int) $recipe->ingredient_id, $usesMainStock ? null : $branchId);

            return floor($stockQuantity / (float) $recipe->recipe_quantity);
        });
    }

    public function availableQuantity(int $ingredientId, ?string $branchId = null): float
    {
        $stockQuantity = $branchId === null
            ? (float) (MainBranchIngredient::query()->whereKey($ingredientId)->value('quantity') ?? 0)
            : (float) (BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredientId)
                ->value('quantity') ?? 0);
        $expiredQuantity = (float) StockBatch::query()
            ->where('ingredient_id', $ingredientId)
            ->when($branchId === null, fn ($query) => $query->whereNull('branch_id'), fn ($query) => $query->where('branch_id', $branchId))
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', now()->toDateString())
            ->sum('quantity_remaining');

        return max(0, round($stockQuantity - $expiredQuantity, 3));
    }

    private function applyDelta(
        MainBranchIngredient $ingredient,
        float $delta,
        string $type,
        ?string $reason,
        ?object $actor,
        array $metadata,
    ): MainBranchStockMovement {
        if ($ingredient->is_archived) {
            throw new InvalidArgumentException('Archived ingredients cannot be adjusted.');
        }

        $before = round((float) $ingredient->quantity, 3);
        $change = round($delta, 3);
        $after = round($before + $change, 3);
        if ($after < 0) {
            throw new InvalidArgumentException('This adjustment would make the stock negative.');
        }
        if ($delta < 0 && $type === 'order_usage' && abs($delta) > $this->availableQuantity($ingredient->id)) {
            throw new InvalidArgumentException('There is not enough unexpired ingredient stock to complete this order.');
        }

        $ingredient->quantity = $after;
        $ingredient->save();
        $movement = MainBranchStockMovement::create([
            'ingredient_id' => $ingredient->id,
            'branch_id' => null,
            'ingredient_name' => $ingredient->name,
            'unit' => $ingredient->unit,
            'type' => $type,
            'quantity' => abs($change),
            'quantity_change' => $change,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'unit_cost' => $metadata['unit_cost'] ?? $ingredient->unit_cost,
            'reason' => $reason,
            'order_id' => $metadata['order_id'] ?? null,
            'supplier_id' => $metadata['supplier_id'] ?? null,
            'purchase_quantity' => $metadata['purchase_quantity'] ?? null,
            'purchase_unit' => $metadata['purchase_unit'] ?? null,
            'invoice_reference' => $metadata['invoice_reference'] ?? null,
            'occurred_at' => $metadata['occurred_at'] ?? now(),
            'admin_id' => $actor instanceof Admin ? $actor->getKey() : null,
            'user_id' => $actor instanceof User ? $actor->getKey() : null,
            'actor_type' => $actor ? $actor::class : null,
            'actor_id' => $actor instanceof Model ? (string) $actor->getKey() : null,
            'performed_by' => $actor?->full_name
                ?? $actor?->fullName
                ?? $actor?->name
                ?? $actor?->email
                ?? 'System',
        ]);

        $this->maintainBatches(null, $ingredient->id, $change, $movement, $metadata, $type);
        $this->refreshProductAvailability($ingredient);

        return $movement;
    }

    private function applyBranchDelta(
        MainBranchIngredient $ingredient,
        BranchIngredientStock $stock,
        float $delta,
        string $type,
        ?string $reason,
        ?object $actor,
        array $metadata,
    ): MainBranchStockMovement {
        if ($ingredient->is_archived) {
            throw new InvalidArgumentException('Archived ingredients cannot be adjusted.');
        }

        $before = round((float) $stock->quantity, 3);
        $change = round($delta, 3);
        $after = round($before + $change, 3);
        if ($after < 0) {
            throw new InvalidArgumentException('This adjustment would make the stock negative.');
        }
        if ($delta < 0 && $type === 'order_usage' && abs($delta) > $this->availableQuantity($ingredient->id, $stock->branch_id)) {
            throw new InvalidArgumentException('There is not enough unexpired ingredient stock to complete this order.');
        }

        $unitCost = (float) ($metadata['unit_cost'] ?? $ingredient->unit_cost ?? $stock->unit_cost ?? 0);
        if ($change > 0) {
            $stock->unit_cost = $after > 0
                ? round((((float) $stock->quantity * (float) ($stock->unit_cost ?? $unitCost)) + ($change * $unitCost)) / $after, 2)
                : round($unitCost, 2);
        }
        $stock->quantity = $after;
        $stock->save();
        $movement = MainBranchStockMovement::create([
            'ingredient_id' => $ingredient->id,
            'branch_id' => $stock->branch_id,
            'ingredient_name' => $ingredient->name,
            'unit' => $ingredient->unit,
            'type' => $type,
            'quantity' => abs($change),
            'quantity_change' => $change,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'unit_cost' => $metadata['unit_cost'] ?? $stock->unit_cost,
            'reason' => $reason,
            'order_id' => $metadata['order_id'] ?? null,
            'supplier_id' => $metadata['supplier_id'] ?? null,
            'purchase_quantity' => $metadata['purchase_quantity'] ?? null,
            'purchase_unit' => $metadata['purchase_unit'] ?? null,
            'invoice_reference' => $metadata['invoice_reference'] ?? null,
            'occurred_at' => $metadata['occurred_at'] ?? now(),
            'admin_id' => $actor instanceof Admin ? $actor->getKey() : null,
            'user_id' => $actor instanceof User ? $actor->getKey() : null,
            'actor_type' => $actor ? $actor::class : null,
            'actor_id' => $actor instanceof Model ? (string) $actor->getKey() : null,
            'performed_by' => $actor?->full_name
                ?? $actor?->fullName
                ?? $actor?->name
                ?? $actor?->email
                ?? 'System',
        ]);

        $this->maintainBatches($stock->branch_id, $ingredient->id, $change, $movement, $metadata, $type);
        $this->refreshProductAvailability($ingredient, $stock->branch_id);

        return $movement;
    }

    private function refreshProductAvailability(MainBranchIngredient $ingredient, ?string $branchId = null): void
    {
        $branchId ??= Franchise::query()->where('is_main', true)->value('id');
        if (! $branchId) {
            return;
        }

        $recipes = DB::table('ingredient_recipes')
            ->where('ingredient_id', $ingredient->id)
            ->get(['product_id']);
        foreach ($recipes as $recipe) {
            $available = $this->availablePortions((string) $recipe->product_id, $branchId);
            FranchiseInventory::query()->updateOrCreate(
                ['franchise_id' => $branchId, 'product_id' => $recipe->product_id],
                ['ingredient_unavailable' => $available === 0],
            );
        }
    }

    private function maintainBatches(
        ?string $branchId,
        int $ingredientId,
        float $delta,
        MainBranchStockMovement $movement,
        array $metadata,
        string $type,
    ): void {
        if ($delta < 0) {
            $remaining = abs($delta);
            $batches = StockBatch::query()
                ->where('ingredient_id', $ingredientId)
                ->where('quantity_remaining', '>', 0)
                ->when($branchId === null, fn ($query) => $query->whereNull('branch_id'), fn ($query) => $query->where('branch_id', $branchId))
                ->when($type === 'order_usage' || ($metadata['exclude_expired'] ?? false), fn ($query) => $query->where(function ($inner) {
                    $inner->whereNull('expires_at')->orWhereDate('expires_at', '>=', now()->toDateString());
                }))
                ->orderByRaw('CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('expires_at')
                ->orderBy('received_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            foreach ($batches as $batch) {
                if ($remaining <= 0) {
                    break;
                }
                $used = min($remaining, (float) $batch->quantity_remaining);
                $batch->quantity_remaining = round((float) $batch->quantity_remaining - $used, 3);
                $batch->save();
                DB::table('stock_batch_movements')->insert([
                    'movement_id' => $movement->id,
                    'stock_batch_id' => $batch->id,
                    'quantity_change' => -$used,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $remaining = round($remaining - $used, 3);
            }

            return;
        }

        $created = 0.0;
        $restoreMovementId = $metadata['restore_batches_from_movement_id'] ?? null;
        if ($restoreMovementId) {
            $allocations = DB::table('stock_batch_movements')
                ->where('movement_id', $restoreMovementId)
                ->where('quantity_change', '<', 0)
                ->orderBy('id')
                ->get(['stock_batch_id', 'quantity_change']);
            foreach ($allocations as $allocation) {
                if ($created >= $delta) {
                    break;
                }
                $batch = StockBatch::query()->lockForUpdate()->find($allocation->stock_batch_id);
                if (! $batch || (string) $batch->branch_id !== (string) $branchId) {
                    continue;
                }
                $quantity = min((float) -$allocation->quantity_change, $delta - $created);
                $batch->quantity_remaining = round((float) $batch->quantity_remaining + $quantity, 3);
                $batch->save();
                DB::table('stock_batch_movements')->insert([
                    'movement_id' => $movement->id,
                    'stock_batch_id' => $batch->id,
                    'quantity_change' => $quantity,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $created += $quantity;
            }
        }

        $lots = $metadata['batch_lots'] ?? [];
        foreach ($lots as $lot) {
            $lotQuantity = min((float) ($lot['quantity'] ?? 0), $delta - $created);
            if ($lotQuantity <= 0) {
                continue;
            }
            $batch = StockBatch::create([
                'branch_id' => $branchId,
                'ingredient_id' => $ingredientId,
                'movement_id' => $movement->id,
                'quantity_received' => round($lotQuantity, 3),
                'quantity_remaining' => round($lotQuantity, 3),
                'received_at' => $metadata['occurred_at'] ?? now(),
                'expires_at' => $lot['expires_at'] ?? null,
            ]);
            DB::table('stock_batch_movements')->insert([
                'movement_id' => $movement->id,
                'stock_batch_id' => $batch->id,
                'quantity_change' => round($lotQuantity, 3),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $created += $lotQuantity;
        }
        $unbatchedQuantity = round($delta - $created, 3);
        if ($unbatchedQuantity > 0) {
            $batch = StockBatch::create([
                'branch_id' => $branchId,
                'ingredient_id' => $ingredientId,
                'movement_id' => $movement->id,
                'quantity_received' => $unbatchedQuantity,
                'quantity_remaining' => $unbatchedQuantity,
                'received_at' => $metadata['occurred_at'] ?? now(),
                'expires_at' => $metadata['expires_at'] ?? null,
            ]);
            DB::table('stock_batch_movements')->insert([
                'movement_id' => $movement->id,
                'stock_batch_id' => $batch->id,
                'quantity_change' => $unbatchedQuantity,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function batchLots(?string $branchId, int $ingredientId, float $quantity): array
    {
        $remaining = round($quantity, 3);
        $lots = [];
        $batches = StockBatch::query()
            ->where('ingredient_id', $ingredientId)
            ->where('quantity_remaining', '>', 0)
            ->when($branchId === null, fn ($query) => $query->whereNull('branch_id'), fn ($query) => $query->where('branch_id', $branchId))
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->orderByRaw('CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expires_at')
            ->orderBy('received_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $used = min($remaining, (float) $batch->quantity_remaining);
            $lots[] = ['quantity' => round($used, 3), 'expires_at' => $batch->expires_at?->toDateString()];
            $remaining = round($remaining - $used, 3);
        }

        return $lots;
    }

    private function isMainBranchOrder(Order $order): bool
    {
        if (! $order->branch_id) {
            return false;
        }

        return Franchise::query()
            ->whereKey($order->branch_id)
            ->where('is_main', true)
            ->exists();
    }
}
