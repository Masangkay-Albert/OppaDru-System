<?php

namespace App\Http\Controllers;

use App\Models\BranchIngredientStock;
use App\Models\InventoryRestockRequest;
use App\Models\InventoryRestockRequestItem;
use App\Models\InventorySupplier;
use App\Models\InventoryTransfer;
use App\Models\MainBranchIngredient;
use App\Models\MainBranchStockMovement;
use App\Models\StockBatch;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BranchInventoryController extends Controller
{
    private const INGREDIENT_CATEGORIES = ['Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other'];

    private function inventoryUnits(): array
    {
        return array_values(array_unique(array_merge(
            config('inventory.countable_units', []),
            config('inventory.legacy_units', [])
        )));
    }

    public function index(Request $request, InventoryService $inventory)
    {
        $branchId = (string) $request->user()->franchise_id;
        $stocks = BranchIngredientStock::query()
            ->with('ingredient:id,name,category,unit,unit_cost,reorder_level')
            ->where('branch_id', $branchId)
            ->where('is_archived', false)
            ->get()
            ->filter(fn (BranchIngredientStock $stock) => $stock->ingredient && ! $stock->ingredient->is_archived)
            ->map(function (BranchIngredientStock $stock) use ($inventory, $branchId) {
                $ingredient = $stock->ingredient;
                $usableQuantity = $inventory->availableQuantity($ingredient->id, $branchId);

                return $this->ingredientPayload($stock, $usableQuantity);
            });
        $trackedIds = $stocks->pluck('id');
        $availableIngredients = MainBranchIngredient::query()
            ->where('is_archived', false)
            ->whereNotIn('id', $trackedIds)
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'unit', 'reorder_level', 'unit_cost']);
        $expiring = StockBatch::query()
            ->with('ingredient:id,name,unit')
            ->where('branch_id', $branchId)
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<=', now()->addDays(7)->toDateString())
            ->orderBy('expires_at')
            ->get();

        return response()->json([
            'data' => [
                'ingredients' => $stocks->values(),
                'available_ingredients' => $availableIngredients,
                'suppliers' => InventorySupplier::query()->orderBy('name')->get(['id', 'name']),
                'summary' => [
                    'total' => $stocks->count(),
                    'low_stock' => $stocks->filter(fn ($stock) => $stock['status'] === 'low_stock')->count(),
                    'out_of_stock' => $stocks->filter(fn ($stock) => $stock['status'] === 'out_of_stock')->count(),
                    'needs_restocking' => $stocks->filter(fn ($stock) => in_array($stock['status'], ['low_stock', 'out_of_stock'], true))->count(),
                    'stock_value' => round($stocks->sum(fn ($stock) => (float) $stock['quantity'] * (float) ($stock['unit_cost'] ?? 0)), 2),
                ],
                'recent_movements' => MainBranchStockMovement::query()
                    ->where('branch_id', $branchId)
                    ->latest('occurred_at')
                    ->latest('id')
                    ->limit(5)
                    ->get(),
                'expiring_soon' => $expiring,
                'restock_requests' => InventoryRestockRequest::query()
                    ->with('items.ingredient:id,name,unit')
                    ->where('branch_id', $branchId)
                    ->latest()
                    ->limit(20)
                    ->get(),
                'transfers' => InventoryTransfer::query()
                    ->with('items.ingredient:id,name,unit')
                    ->where('destination_branch_id', $branchId)
                    ->latest()
                    ->limit(20)
                    ->get(),
            ],
        ]);
    }

    public function store(Request $request, InventoryService $inventory)
    {
        $validated = $request->validate([
            'ingredient_id' => ['nullable', 'required_without:name', 'integer', Rule::exists('main_branch_ingredients', 'id')->where('is_archived', 0)],
            'name' => 'required_without:ingredient_id|string|max:160',
            'category' => ['required_with:name', 'string', Rule::in(self::INGREDIENT_CATEGORIES)],
            'unit' => ['required_with:name', 'string', Rule::in($this->inventoryUnits())],
            'purchase_unit' => ['nullable', 'string', Rule::in($this->inventoryUnits())],
            'conversion_factor' => 'nullable|numeric|gt:0|max:999999.999999',
            'supplier_id' => ['nullable', 'integer', Rule::exists('inventory_suppliers', 'id')],
            'initial_quantity' => 'nullable|numeric|min:0|max:999999999.999',
            'reorder_level' => 'required|numeric|min:0|max:999999999.999',
            'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
            'notes' => 'nullable|string|max:255',
        ]);
        $branchId = (string) $request->user()->franchise_id;
        $actor = $request->user();

        try {
            $stock = DB::transaction(function () use ($validated, $branchId, $actor, $inventory) {
                if (! empty($validated['ingredient_id'])) {
                    $ingredient = MainBranchIngredient::query()->lockForUpdate()->findOrFail($validated['ingredient_id']);
                } else {
                    $duplicate = MainBranchIngredient::query()
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($validated['name']))])
                        ->lockForUpdate()
                        ->first();
                    if ($duplicate) {
                        throw new \InvalidArgumentException('An ingredient with this name already exists. Choose it from the existing ingredient list.');
                    }

                    $ingredient = MainBranchIngredient::create([
                        'name' => trim($validated['name']),
                        'category' => $validated['category'],
                        'unit' => $validated['unit'],
                        'purchase_unit' => $validated['purchase_unit'] ?? $validated['unit'],
                        'conversion_factor' => $validated['conversion_factor'] ?? 1,
                        'quantity' => 0,
                        'reorder_level' => $validated['reorder_level'],
                        'unit_cost' => $validated['unit_cost'] ?? null,
                        'supplier_id' => $validated['supplier_id'] ?? null,
                        'notes' => $validated['notes'] ?? null,
                    ]);
                }
                $stock = BranchIngredientStock::query()
                    ->where('branch_id', $branchId)
                    ->where('ingredient_id', $ingredient->id)
                    ->lockForUpdate()
                    ->first();
                if ($stock && ! $stock->is_archived) {
                    throw new \InvalidArgumentException('This ingredient is already tracked for your branch.');
                }
                if ($stock) {
                    $stock->update([
                        'is_archived' => false,
                        'reorder_level' => $validated['reorder_level'],
                        'unit_cost' => $validated['unit_cost'] ?? $ingredient->unit_cost,
                        'notes' => $validated['notes'] ?? null,
                    ]);
                } else {
                    $stock = BranchIngredientStock::create([
                        'branch_id' => $branchId,
                        'ingredient_id' => $ingredient->id,
                        'quantity' => 0,
                        'reorder_level' => $validated['reorder_level'],
                        'unit_cost' => $validated['unit_cost'] ?? $ingredient->unit_cost,
                        'notes' => $validated['notes'] ?? null,
                    ]);
                }
                $initialQuantity = (float) ($validated['initial_quantity'] ?? 0);
                if ($initialQuantity > 0) {
                    $inventory->moveBranch($branchId, $ingredient->id, 'opening_stock', $initialQuantity, 'Starting branch stock', $actor);
                }
                $inventory->refreshBranchAvailability($ingredient->id, $branchId);

                return $stock->refresh()->load('ingredient:id,name,category,unit');
            }, 3);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $this->ingredientPayload($stock, $inventory->availableQuantity($stock->ingredient_id, $branchId))], 201);
    }

    public function update(Request $request, MainBranchIngredient $ingredient)
    {
        abort_if($ingredient->is_archived, 404);
        $validated = $request->validate([
            'reorder_level' => 'required|numeric|min:0|max:999999999.999',
            'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
            'notes' => 'nullable|string|max:255',
        ]);
        $stock = BranchIngredientStock::query()
            ->where('branch_id', (string) $request->user()->franchise_id)
            ->where('ingredient_id', $ingredient->id)
            ->where('is_archived', false)
            ->firstOrFail();
        $stock->update($validated);

        return response()->json(['data' => $this->ingredientPayload($stock->load('ingredient:id,name,category,unit'), app(InventoryService::class)->availableQuantity($ingredient->id, (string) $request->user()->franchise_id))]);
    }

    public function archive(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        abort_if($ingredient->is_archived, 404);
        $branchId = (string) $request->user()->franchise_id;
        $stock = BranchIngredientStock::query()
            ->where('branch_id', $branchId)
            ->where('ingredient_id', $ingredient->id)
            ->where('is_archived', false)
            ->firstOrFail();
        $stock->update(['is_archived' => true]);
        $inventory->refreshBranchAvailability($ingredient->id, $branchId);

        return response()->json(['data' => ['ingredient_id' => $ingredient->id, 'is_archived' => true]]);
    }

    public function adjust(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        abort_if($ingredient->is_archived, 404);
        $validated = $request->validate([
            'type' => ['required', Rule::in(['stock_in', 'stock_out', 'waste', 'adjustment', 'count_adjustment'])],
            'quantity' => 'required|numeric|min:0|max:999999999.999',
            'reason' => 'nullable|string|max:2000',
        ]);
        if (in_array($validated['type'], ['adjustment', 'count_adjustment', 'waste'], true)) {
            $request->validate(['reason' => 'required|string|max:2000']);
        }

        try {
            $branchId = (string) $request->user()->franchise_id;
            BranchIngredientStock::query()
                ->where('branch_id', $branchId)
                ->where('ingredient_id', $ingredient->id)
                ->where('is_archived', false)
                ->firstOrFail();
            if (in_array($validated['type'], ['adjustment', 'count_adjustment'], true)) {
                $inventory->setBranchQuantity(
                    $branchId,
                    $ingredient->id,
                    (float) $validated['quantity'],
                    $validated['type'],
                    $validated['reason'],
                    $request->user(),
                );
            } else {
                $inventory->moveBranch(
                    (string) $request->user()->franchise_id,
                    $ingredient->id,
                    $validated['type'],
                    (float) $validated['quantity'],
                    $validated['reason'] ?? null,
                    $request->user(),
                );
            }
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => ['ingredient_id' => $ingredient->id, 'saved' => true]]);
    }

    public function history(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'nullable|integer|exists:main_branch_ingredients,id',
            'type' => ['nullable', Rule::in(['stock_in', 'stock_out', 'adjustment', 'waste', 'order_usage', 'count_adjustment', 'opening_stock'])],
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        $query = MainBranchStockMovement::query()
            ->where('branch_id', (string) $request->user()->franchise_id)
            ->when($validated['ingredient_id'] ?? null, fn ($builder, $id) => $builder->where('ingredient_id', $id))
            ->when($validated['type'] ?? null, fn ($builder, $type) => $builder->where('type', $type))
            ->when($validated['from'] ?? null, fn ($builder, $date) => $builder->whereDate('occurred_at', '>=', $date))
            ->when($validated['to'] ?? null, fn ($builder, $date) => $builder->whereDate('occurred_at', '<=', $date))
            ->latest('occurred_at')
            ->latest('id');

        return response()->json(['data' => $query->paginate((int) ($validated['per_page'] ?? 15))]);
    }

    public function export(Request $request)
    {
        $stocks = BranchIngredientStock::query()
            ->with('ingredient:id,name,category,unit')
            ->where('branch_id', (string) $request->user()->franchise_id)
            ->where('is_archived', false)
            ->orderBy('ingredient_id')
            ->get();

        return response()->streamDownload(function () use ($stocks) {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['ingredient_id', 'name', 'category', 'unit', 'quantity', 'reorder_level', 'unit_cost', 'notes']);
            foreach ($stocks as $stock) {
                fputcsv($output, [
                    $stock->ingredient_id,
                    $stock->ingredient?->name,
                    $stock->ingredient?->category,
                    $stock->ingredient?->unit,
                    $stock->quantity,
                    $stock->reorder_level,
                    $stock->unit_cost,
                    $stock->notes,
                ]);
            }
            fclose($output);
        }, 'branch-ingredient-inventory.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function import(Request $request, InventoryService $inventory)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'The CSV file could not be read.'], 422);
        }
        $columns = array_map(fn ($value) => strtolower(trim((string) $value)), fgetcsv($handle) ?: []);
        $expected = ['ingredient_id', 'name', 'category', 'unit', 'quantity', 'reorder_level', 'unit_cost', 'notes'];
        if ($columns !== $expected) {
            fclose($handle);

            return response()->json(['message' => 'Use the exported branch inventory CSV format.'], 422);
        }

        $branchId = (string) $request->user()->franchise_id;
        $imported = 0;
        $errors = [];
        $line = 1;
        $seenIngredients = [];
        while (($values = fgetcsv($handle)) !== false) {
            $line++;
            if ($values === [null] || $values === []) {
                continue;
            }
            if (count($values) !== count($columns)) {
                $errors[] = ['row' => $line, 'errors' => ['The row must contain the same number of columns as the header.']];
                continue;
            }
            $row = array_combine($columns, array_pad(array_slice($values, 0, count($columns)), count($columns), ''));
            $validator = validator($row, [
                'ingredient_id' => ['required', 'integer', Rule::exists('main_branch_ingredients', 'id')->where('is_archived', 0)],
                'quantity' => 'required|numeric|min:0|max:999999999.999',
                'reorder_level' => 'required|numeric|min:0|max:999999999.999',
                'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
                'notes' => 'nullable|string|max:255',
            ]);
            if ($validator->fails()) {
                $errors[] = ['row' => $line, 'errors' => $validator->errors()->all()];
                continue;
            }
            if (isset($seenIngredients[(string) $row['ingredient_id']])) {
                $errors[] = ['row' => $line, 'errors' => ['This ingredient appears more than once in the CSV.']];
                continue;
            }
            $seenIngredients[(string) $row['ingredient_id']] = true;
            try {
                DB::transaction(function () use ($row, $branchId, $request, $inventory) {
                    $ingredient = MainBranchIngredient::query()->where('is_archived', false)->lockForUpdate()->findOrFail((int) $row['ingredient_id']);
                    $stock = BranchIngredientStock::query()
                        ->where('branch_id', $branchId)
                        ->where('ingredient_id', $ingredient->id)
                        ->lockForUpdate()
                        ->first();
                    if ($stock?->is_archived) {
                        throw new \InvalidArgumentException('Archived branch ingredients cannot be imported.');
                    }
                    $stock ??= BranchIngredientStock::create([
                        'branch_id' => $branchId,
                        'ingredient_id' => $ingredient->id,
                        'quantity' => 0,
                        'reorder_level' => $row['reorder_level'],
                        'unit_cost' => $row['unit_cost'] !== '' ? $row['unit_cost'] : $ingredient->unit_cost,
                        'notes' => $row['notes'] ?: null,
                    ]);
                    $stock->update([
                        'reorder_level' => $row['reorder_level'],
                        'unit_cost' => $row['unit_cost'] !== '' ? $row['unit_cost'] : $stock->unit_cost,
                        'notes' => $row['notes'] ?: null,
                    ]);
                    $inventory->setBranchQuantity(
                        $branchId,
                        $ingredient->id,
                        (float) $row['quantity'],
                        'count_adjustment',
                        'CSV stock count import',
                        $request->user(),
                    );
                }, 3);
                $imported++;
            } catch (\InvalidArgumentException $exception) {
                $errors[] = ['row' => $line, 'errors' => [$exception->getMessage()]];
            }
        }
        fclose($handle);

        return response()->json(['data' => ['imported' => $imported, 'errors' => $errors]]);
    }

    public function requestRestock(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1|max:100',
            'items.*.ingredient_id' => ['required', 'integer', 'distinct', Rule::exists('main_branch_ingredients', 'id')->where('is_archived', 0)],
            'items.*.quantity' => 'required|numeric|gt:0|max:999999999.999',
            'notes' => 'nullable|string|max:2000',
        ]);
        $user = $request->user();
        $restockRequest = DB::transaction(function () use ($validated, $user) {
            $restockRequest = InventoryRestockRequest::create([
                'branch_id' => $user->franchise_id,
                'status' => 'pending',
                'requested_by' => $user->full_name ?? $user->fullName ?? $user->email ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);
            foreach ($validated['items'] as $item) {
                InventoryRestockRequestItem::create([
                    'request_id' => $restockRequest->id,
                    'ingredient_id' => $item['ingredient_id'],
                    'requested_quantity' => $item['quantity'],
                ]);
            }

            return $restockRequest;
        });

        return response()->json(['data' => $restockRequest->load('items.ingredient:id,name,unit')], 201);
    }

    public function receiveTransfer(Request $request, InventoryTransfer $transfer)
    {
        if ((string) $transfer->destination_branch_id !== (string) $request->user()->franchise_id) {
            return response()->json(['message' => 'This transfer belongs to another branch.'], 404);
        }
        try {
            $transfer = DB::transaction(function () use ($request, $transfer) {
                $lockedTransfer = InventoryTransfer::query()->with('items')->lockForUpdate()->findOrFail($transfer->id);
                if ($lockedTransfer->status !== 'dispatched') {
                    throw new \InvalidArgumentException('This transfer is not awaiting receipt.');
                }
                $inventory = app(InventoryService::class);
                foreach ($lockedTransfer->items as $item) {
                    $inventory->receiveTransferItem(
                        (string) $lockedTransfer->destination_branch_id,
                        (int) $item->ingredient_id,
                        (float) $item->quantity,
                        null,
                        $item->batch_lots ?? [],
                        $request->user(),
                        'Received transfer '.$lockedTransfer->reference,
                    );
                }
                $lockedTransfer->update(['status' => 'received', 'received_at' => now()]);
                if ($lockedTransfer->request_id) {
                    InventoryRestockRequest::query()->whereKey($lockedTransfer->request_id)->update([
                        'status' => 'fulfilled',
                        'updated_at' => now(),
                    ]);
                }

                return $lockedTransfer->load('items.ingredient:id,name,unit');
            }, 3);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $transfer]);
    }

    private function ingredientPayload(BranchIngredientStock $stock, float $usableQuantity): array
    {
        $ingredient = $stock->ingredient;
        $quantity = (float) $stock->quantity;
        $reorderLevel = (float) $stock->reorder_level;

        return [
            'id' => $ingredient->id,
            'name' => $ingredient->name,
            'category' => $ingredient->category,
            'unit' => $ingredient->unit,
            'quantity' => $stock->quantity,
            'usable_quantity' => $usableQuantity,
            'reorder_level' => $stock->reorder_level,
            'unit_cost' => $stock->unit_cost,
            'notes' => $stock->notes,
            'updated_at' => $stock->updated_at,
            'status' => $usableQuantity <= 0 ? 'out_of_stock' : ($usableQuantity <= $reorderLevel ? 'low_stock' : 'in_stock'),
            'stock_value' => round($quantity * (float) ($stock->unit_cost ?? 0), 2),
        ];
    }
}
