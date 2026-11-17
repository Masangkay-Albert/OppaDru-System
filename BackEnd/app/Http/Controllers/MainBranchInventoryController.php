<?php

namespace App\Http\Controllers;

use App\Models\IngredientRecipe;
use App\Models\Franchise;
use App\Models\InventoryRestockRequest;
use App\Models\InventoryRestockRequestItem;
use App\Models\InventoryTransfer;
use App\Models\InventoryTransferItem;
use App\Models\InventorySupplier;
use App\Models\MainBranchIngredient;
use App\Models\MainBranchStockMovement;
use App\Models\Product;
use App\Models\StockBatch;
use App\Services\InventoryCosting;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class MainBranchInventoryController extends Controller
{
    private const CATEGORIES = ['Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other'];
    private const MOVEMENT_TYPES = [
        'stock_in',
        'stock_out',
        'adjustment',
        'waste',
        'order_usage',
        'count_adjustment',
        'opening_stock',
    ];

    private function inventoryUnits(): array
    {
        return array_values(array_unique(array_merge(
            config('inventory.countable_units', []),
            config('inventory.legacy_units', [])
        )));
    }

    public function index()
    {
        $ingredients = MainBranchIngredient::query()
            ->with('supplierRelation:id,name')
            ->where('is_archived', false)
            ->orderBy('name')
            ->get();
        $this->attachUsableQuantities($ingredients);
        $purchaseHistory = MainBranchStockMovement::query()
            ->with('supplier:id,name')
            ->whereNull('branch_id')
            ->whereIn('ingredient_id', $ingredients->pluck('id'))
            ->whereIn('type', ['stock_in', 'opening_stock'])
            ->where('quantity_change', '>', 0)
            ->whereRaw('LOWER(COALESCE(reason, \'\')) NOT LIKE ?', ['%transfer%'])
            ->latest('occurred_at')
            ->latest('id')
            ->get()
            ->groupBy('ingredient_id');
        foreach ($ingredients as $ingredient) {
            $ingredient->setAttribute('average_unit_cost', $ingredient->inventory_value !== null && (float) $ingredient->quantity > 0
                ? InventoryCosting::unitCost((string) $ingredient->inventory_value, (string) $ingredient->quantity, 4)
                : $ingredient->unit_cost);
            $ingredient->setAttribute('stock_value', InventoryCosting::currentValue(
                $ingredient->inventory_value === null ? null : (string) $ingredient->inventory_value,
                (string) $ingredient->quantity,
                $ingredient->unit_cost === null ? null : (string) $ingredient->unit_cost,
            ) ?? '0.00');
            $ingredient->setAttribute('purchase_history', ($purchaseHistory->get($ingredient->id) ?? collect())->take(5)->values());
        }

        return response()->json([
            'data' => [
                'ingredients' => $ingredients,
                'all_ingredients' => MainBranchIngredient::query()
                    ->orderBy('name')
                    ->get(['id', 'name', 'is_archived']),
                'suppliers' => InventorySupplier::query()->orderBy('name')->get(),
                'categories' => self::CATEGORIES,
                'summary' => $this->calculateSummary($ingredients),
                'recent_movements' => MainBranchStockMovement::query()
                    ->with(['ingredient:id,name,unit', 'supplier:id,name'])
                    ->whereNull('branch_id')
                    ->whereNotIn('type', ['adjustment', 'count_adjustment'])
                    ->latest()
                    ->limit(5)
                    ->get(),
                'expiring_batches' => StockBatch::query()
                    ->with('ingredient:id,name,unit')
                    ->whereNull('branch_id')
                    ->where('quantity_remaining', '>', 0)
                    ->whereNotNull('expires_at')
                    ->whereDate('expires_at', '<=', now()->addDays(7)->toDateString())
                    ->orderBy('expires_at')
                    ->get(),
            ],
        ]);
    }

    public function summary()
    {
        $ingredients = MainBranchIngredient::query()
            ->where('is_archived', false)
            ->get(['id', 'quantity', 'reorder_level', 'unit_cost', 'inventory_value']);
        $this->attachUsableQuantities($ingredients);

        return response()->json(['data' => $this->calculateSummary($ingredients)]);
    }

    public function store(Request $request, InventoryService $inventory)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'min:'.config('input_limits.ingredient_name.min'),
                'max:'.config('input_limits.ingredient_name.max'),
                'regex:'.config('input_limits.ingredient_name.pattern'),
            ],
            'category' => ['required', 'string', Rule::in(self::CATEGORIES)],
            'unit' => ['required', 'string', Rule::in($this->inventoryUnits())],
            'purchase_unit' => ['nullable', 'string', Rule::in($this->inventoryUnits())],
            'conversion_factor' => 'nullable|numeric|gt:0|max:'.config('input_limits.inventory_conversion'),
            'quantity' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
            'reorder_level' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
            'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
            'total_price_paid' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('inventory.max_total_price_paid')],
            'supplier_id' => 'nullable|integer|exists:inventory_suppliers,id',
            'notes' => 'nullable|string|max:'.config('input_limits.long_text'),
        ]);
        if (($validated['total_price_paid'] ?? null) !== null && bccomp((string) $validated['quantity'], '0', 3) <= 0) {
            return response()->json([
                'message' => 'Enter a quantity before adding a total price.',
                'errors' => ['quantity' => ['Enter a quantity before adding a total price.']],
            ], 422);
        }
        $this->ensureUniqueName($validated['name']);

        $quantity = (float) $validated['quantity'];
        $totalPricePaid = $validated['total_price_paid'] ?? null;
        unset($validated['total_price_paid']);
        if ($totalPricePaid !== null) {
            $validated['unit_cost'] = null;
        }
        unset($validated['quantity']);
        $ingredient = DB::transaction(function () use ($validated, $quantity, $totalPricePaid, $request, $inventory) {
            $ingredient = MainBranchIngredient::create([
                ...$validated,
                'purchase_unit' => $validated['purchase_unit'] ?? $validated['unit'],
                'conversion_factor' => $validated['conversion_factor'] ?? 1,
                'quantity' => 0,
            ]);
            if ($quantity > 0) {
                $inventory->move(
                    $ingredient->id,
                    'opening_stock',
                    $quantity,
                    'Opening stock',
                    $request->user(),
                    $totalPricePaid === null ? [] : [
                        'total_cost' => InventoryCosting::normalizeMoney($totalPricePaid),
                        'unit_cost' => InventoryCosting::unitCost($totalPricePaid, (string) $quantity, 4),
                    ],
                );
            }

            return $ingredient->fresh()->load('supplierRelation:id,name');
        });

        return response()->json(['data' => $ingredient], 201);
    }

    public function update(Request $request, MainBranchIngredient $ingredient)
    {
        $requestedName = $request->input('name');
        $nameUnchanged = is_string($requestedName)
            && trim($requestedName) === trim((string) $ingredient->name);
        $nameRules = ['required', 'string'];
        if (! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.ingredient_name.min'),
                'max:'.config('input_limits.ingredient_name.max'),
                'regex:'.config('input_limits.ingredient_name.pattern'),
            ];
        }
        $requestedNotes = $request->input('notes');
        $notesUnchanged = $request->exists('notes')
            && is_string($requestedNotes)
            && trim($requestedNotes) === trim((string) $ingredient->notes);
        $notesRules = ['nullable', 'string'];
        if ($request->exists('notes') && ! $notesUnchanged) {
            $notesRules[] = 'max:'.config('input_limits.long_text');
        }
        $validated = $request->validate([
            'name' => $nameRules,
            'category' => 'required|string|max:100',
            'unit' => ['required', 'string', Rule::in($this->inventoryUnits())],
            'purchase_unit' => ['nullable', 'string', Rule::in($this->inventoryUnits())],
            'conversion_factor' => 'required|numeric|gt:0|max:'.config('input_limits.inventory_conversion'),
            'reorder_level' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
            'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
            'total_price_paid' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('inventory.max_total_price_paid')],
            'supplier_id' => 'nullable|integer|exists:inventory_suppliers,id',
            'notes' => $notesRules,
        ]);
        if ($nameUnchanged) {
            $validated['name'] = $ingredient->name;
        }
        if ($notesUnchanged) {
            $validated['notes'] = $ingredient->notes;
        }
        $this->ensureUniqueName($validated['name'], $ingredient->id);

        $totalPricePaid = $validated['total_price_paid'] ?? null;
        unset($validated['total_price_paid']);
        if ($totalPricePaid !== null) {
            unset($validated['unit_cost']);
            try {
                app(InventoryService::class)->setMainStockPrice($ingredient->id, $totalPricePaid);
            } catch (\InvalidArgumentException $exception) {
                return response()->json([
                    'message' => $exception->getMessage(),
                    'errors' => ['total_price_paid' => [$exception->getMessage()]],
                ], 422);
            }
        }
        $ingredient->fill($validated)->save();

        return response()->json(['data' => $ingredient->fresh()->load('supplierRelation:id,name')]);
    }

    public function adjust(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['stock_in', 'stock_out', 'waste', 'adjustment'])],
            'quantity' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
            'total_price_paid' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('inventory.max_total_price_paid')],
            'reason' => ['nullable', 'string', 'min:'.config('input_limits.reason.min'), 'max:'.config('input_limits.reason.max')],
        ]);
        if (($validated['total_price_paid'] ?? null) !== null && $validated['type'] !== 'stock_in') {
            return response()->json(['message' => 'A total price can only be recorded when adding stock.'], 422);
        }

        if ($validated['type'] !== 'adjustment' && (float) $validated['quantity'] <= 0) {
            return response()->json(['message' => 'Enter a quantity greater than zero.'], 422);
        }

        try {
            if ($validated['type'] === 'adjustment') {
                $inventory->setQuantity(
                    $ingredient->id,
                    (float) $validated['quantity'],
                    'adjustment',
                    $validated['reason'] ?? null,
                    $request->user(),
                );
            } else {
                $inventory->move(
                    $ingredient->id,
                    $validated['type'],
                    (float) $validated['quantity'],
                    $validated['reason'] ?? null,
                    $request->user(),
                    ($validated['total_price_paid'] ?? null) === null ? [] : [
                        'total_cost' => InventoryCosting::normalizeMoney($validated['total_price_paid']),
                        'unit_cost' => InventoryCosting::unitCost(
                            $validated['total_price_paid'],
                            (string) $validated['quantity'],
                            4,
                        ),
                    ],
                );
            }
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $ingredient->fresh()->load('supplierRelation:id,name')]);
    }

    public function receive(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        $validated = $request->validate([
            'quantity' => 'required|numeric|gt:0|max:'.config('input_limits.inventory_quantity'),
            'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
            'total_price_paid' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('inventory.max_total_price_paid')],
            'supplier_id' => 'nullable|integer|exists:inventory_suppliers,id',
            'occurred_at' => 'nullable|date',
            'invoice_reference' => 'nullable|string|max:160',
            'expires_at' => 'nullable|date|after_or_equal:today',
            'reason' => ['nullable', 'string', 'min:'.config('input_limits.reason.min'), 'max:'.config('input_limits.reason.max')],
        ]);

        try {
            $inventory->receive(
                $ingredient->id,
                (float) $validated['quantity'],
                isset($validated['unit_cost']) ? (float) $validated['unit_cost'] : null,
                $validated['reason'] ?? 'Stock received',
                $request->user(),
                [
                    'supplier_id' => $validated['supplier_id'] ?? $ingredient->supplier_id,
                    'occurred_at' => $validated['occurred_at'] ?? now(),
                    'invoice_reference' => $validated['invoice_reference'] ?? null,
                    'expires_at' => $validated['expires_at'] ?? null,
                ],
                $validated['total_price_paid'] ?? null,
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $ingredient->fresh()->load('supplierRelation:id,name')]);
    }

    public function countStock(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        $validated = $request->validate([
            'quantity' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
            'reason' => ['nullable', 'string', 'min:'.config('input_limits.reason.min'), 'max:'.config('input_limits.reason.max')],
        ]);

        try {
            $inventory->setQuantity(
                $ingredient->id,
                (float) $validated['quantity'],
                'count_adjustment',
                $validated['reason'] ?? null,
                $request->user(),
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $ingredient->fresh()]);
    }

    public function archive(MainBranchIngredient $ingredient)
    {
        if ($ingredient->is_archived) {
            return response()->json(['message' => 'This ingredient is already archived.'], 422);
        }

        $ingredient->is_archived = true;
        $ingredient->save();

        return response()->json(['data' => ['id' => $ingredient->id, 'is_archived' => true]]);
    }

    public function movements(Request $request)
    {
        $validated = $request->validate([
            'ingredient_id' => 'nullable|integer|exists:main_branch_ingredients,id',
            'type' => ['nullable', Rule::in(self::MOVEMENT_TYPES)],
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = MainBranchStockMovement::query()
            ->with(['ingredient:id,name,unit', 'supplier:id,name'])
            ->whereNotIn('type', ['adjustment', 'count_adjustment'])
            ->when($validated['ingredient_id'] ?? null, fn ($builder, $id) => $builder->where('ingredient_id', $id))
            ->when($validated['type'] ?? null, fn ($builder, $type) => $builder->where('type', $type))
            ->when($validated['from'] ?? null, fn ($builder, $date) => $builder->whereDate('occurred_at', '>=', $date))
            ->when($validated['to'] ?? null, fn ($builder, $date) => $builder->whereDate('occurred_at', '<=', $date))
            ->latest('occurred_at')
            ->latest('id');

        return response()->json(['data' => $query->paginate((int) ($validated['per_page'] ?? 15))]);
    }

    public function ingredientMovements(MainBranchIngredient $ingredient)
    {
        return response()->json([
            'data' => $ingredient->movements()
                ->with('supplier:id,name')
                ->whereNotIn('type', ['adjustment', 'count_adjustment'])
                ->latest('occurred_at')
                ->limit(10)
                ->get(),
        ]);
    }

    public function suppliers()
    {
        return response()->json(['data' => InventorySupplier::query()->withCount('ingredients')->orderBy('name')->get()]);
    }

    public function storeSupplier(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
                'unique:inventory_suppliers,name',
            ],
            'contact_person' => [
                'nullable',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'phone' => ['nullable', 'string', 'max:13', 'regex:'.config('input_limits.phone')],
            'email' => 'nullable|email|max:'.config('input_limits.email'),
            'lead_time_days' => 'nullable|integer|min:0|max:3650',
            'notes' => 'nullable|string|max:'.config('input_limits.long_text'),
        ]);
        if (isset($validated['email'])) {
            $validated['email'] = strtolower(trim($validated['email']));
        }
        if (isset($validated['phone'])) {
            $digits = preg_replace('/\D/', '', $validated['phone']);
            $validated['phone'] = str_starts_with($digits, '63') ? '0'.substr($digits, 2) : $digits;
        }

        return response()->json(['data' => InventorySupplier::create($validated)], 201);
    }

    public function updateSupplier(Request $request, InventorySupplier $supplier)
    {
        $unchanged = static function (string $field) use ($request, $supplier): bool {
            if (! $request->exists($field)) {
                return false;
            }
            $submitted = $request->input($field);
            $current = $supplier->getAttribute($field);

            return $submitted === $current
                || (is_string($submitted) && is_string($current) && trim($submitted) === trim($current));
        };
        $unchangedFields = [];
        foreach (['name', 'contact_person', 'phone', 'email', 'lead_time_days', 'notes'] as $field) {
            $unchangedFields[$field] = $unchanged($field);
        }
        $nameRules = ['required', 'string', Rule::unique('inventory_suppliers', 'name')->ignore($supplier->id)];
        if (! $unchangedFields['name']) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
            ];
        }
        $contactPersonRules = ['nullable', 'string'];
        if (! $unchangedFields['contact_person']) {
            $contactPersonRules = [
                ...$contactPersonRules,
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ];
        }
        $phoneRules = ['nullable', 'string'];
        if (! $unchangedFields['phone']) {
            $phoneRules = [...$phoneRules, 'max:13', 'regex:'.config('input_limits.phone')];
        }
        $emailRules = ['nullable', 'email'];
        if (! $unchangedFields['email']) {
            $emailRules[] = 'max:'.config('input_limits.email');
        }
        $leadTimeRules = ['nullable', 'integer'];
        if (! $unchangedFields['lead_time_days']) {
            $leadTimeRules = [...$leadTimeRules, 'min:0', 'max:3650'];
        }
        $notesRules = ['nullable', 'string'];
        if (! $unchangedFields['notes']) {
            $notesRules[] = 'max:'.config('input_limits.long_text');
        }
        $validated = $request->validate([
            'name' => $nameRules,
            'contact_person' => $contactPersonRules,
            'phone' => $phoneRules,
            'email' => $emailRules,
            'lead_time_days' => $leadTimeRules,
            'notes' => $notesRules,
        ]);
        foreach ($unchangedFields as $field => $isUnchanged) {
            if ($isUnchanged) {
                $validated[$field] = $supplier->getAttribute($field);
            }
        }
        if (! $unchangedFields['email'] && isset($validated['email'])) {
            $validated['email'] = strtolower(trim($validated['email']));
        }
        if (! $unchangedFields['phone'] && isset($validated['phone'])) {
            $digits = preg_replace('/\D/', '', $validated['phone']);
            $validated['phone'] = str_starts_with($digits, '63') ? '0'.substr($digits, 2) : $digits;
        }
        $supplier->update($validated);

        return response()->json(['data' => $supplier->fresh()]);
    }

    public function deleteSupplier(InventorySupplier $supplier)
    {
        if ($supplier->ingredients()->exists() || $supplier->movements()->exists()) {
            return response()->json(['message' => 'This supplier is linked to inventory records and cannot be deleted.'], 422);
        }
        $supplier->delete();

        return response()->json(['data' => ['id' => $supplier->id, 'deleted' => true]]);
    }

    public function restockRequests()
    {
        return response()->json([
            'data' => InventoryRestockRequest::query()
                ->with(['branch:id,name', 'items.ingredient:id,name,unit'])
                ->latest()
                ->paginate(20),
        ]);
    }

    public function rejectRestockRequest(Request $request, InventoryRestockRequest $restockRequest)
    {
        if ($restockRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending restock requests can be rejected.'], 422);
        }
        $validated = $request->validate(['notes' => 'nullable|string|max:'.config('input_limits.long_text')]);
        $restockRequest->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user()?->id,
            'notes' => $validated['notes'] ?? $restockRequest->notes,
        ]);

        return response()->json(['data' => $restockRequest->fresh()->load(['branch:id,name', 'items.ingredient:id,name,unit'])]);
    }

    public function createTransfer(Request $request, InventoryService $inventory)
    {
        $validated = $request->validate([
            'branch_id' => 'required|string|exists:franchises,id',
            'request_id' => 'nullable|integer|exists:inventory_restock_requests,id',
            'items' => 'required|array|min:1|max:100',
            'items.*.ingredient_id' => ['required', 'integer', 'distinct', Rule::exists('main_branch_ingredients', 'id')->where('is_archived', 0)],
            'items.*.quantity' => 'required|numeric|gt:0|max:'.config('input_limits.inventory_quantity'),
            'notes' => 'nullable|string|max:'.config('input_limits.long_text'),
        ]);
        $mainBranchId = Franchise::query()->where('is_main', true)->value('id');
        if (! $mainBranchId) {
            return response()->json(['message' => 'The main branch is not configured.'], 422);
        }
        if ((string) $mainBranchId === (string) $validated['branch_id']) {
            return response()->json(['message' => 'Stock transfers must target a different branch.'], 422);
        }

        try {
            $transfer = DB::transaction(function () use ($validated, $mainBranchId, $request, $inventory) {
                $restockRequest = null;
                if (! empty($validated['request_id'])) {
                    $restockRequest = InventoryRestockRequest::query()
                        ->lockForUpdate()
                        ->findOrFail($validated['request_id']);
                    if ($restockRequest->status !== 'pending'
                        || (string) $restockRequest->branch_id !== (string) $validated['branch_id']) {
                        throw new \InvalidArgumentException('This restock request is no longer available for transfer.');
                    }
                }
                $requestedItems = $restockRequest
                    ? InventoryRestockRequestItem::query()->where('request_id', $restockRequest->id)->lockForUpdate()->get()->keyBy('ingredient_id')
                    : collect();
                if ($restockRequest) {
                    $submittedItems = collect($validated['items'])->keyBy('ingredient_id');
                    if ($requestedItems->count() !== $submittedItems->count()) {
                        throw new \InvalidArgumentException('The transfer items must match the restock request.');
                    }
                    foreach ($requestedItems as $ingredientId => $requestedItem) {
                        $submittedItem = $submittedItems->get($ingredientId);
                        if (! $submittedItem || round((float) $submittedItem['quantity'], 3) !== round((float) $requestedItem->requested_quantity, 3)) {
                            throw new \InvalidArgumentException('The transfer quantities must match the restock request.');
                        }
                    }
                }

                $transfer = InventoryTransfer::create([
                    'source_branch_id' => $mainBranchId,
                    'destination_branch_id' => $validated['branch_id'],
                    'request_id' => $restockRequest?->id,
                    'reference' => 'TRF-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                    'status' => 'received',
                    'notes' => $validated['notes'] ?? null,
                    'dispatched_by' => $request->user()?->id,
                    'received_at' => now(),
                ]);
                foreach ($validated['items'] as $item) {
                    $dispatch = $inventory->dispatchToBranch(
                        (int) $item['ingredient_id'],
                        (float) $item['quantity'],
                        $request->user(),
                        'Stock transfer '.$transfer->reference,
                    );
                    $inventory->receiveTransferItem(
                        (string) $validated['branch_id'],
                        (int) $item['ingredient_id'],
                        (float) $item['quantity'],
                        $dispatch['movement']->unit_cost === null ? null : (string) $dispatch['movement']->unit_cost,
                        $dispatch['batch_lots'],
                        $request->user(),
                        'Stock transfer '.$transfer->reference,
                        $dispatch['movement']->total_cost === null ? null : (string) $dispatch['movement']->total_cost,
                    );
                    InventoryTransferItem::create([
                        'transfer_id' => $transfer->id,
                        'ingredient_id' => $item['ingredient_id'],
                        'quantity' => $item['quantity'],
                        'source_movement_id' => $dispatch['movement']->id,
                        'batch_lots' => $dispatch['batch_lots'],
                    ]);
                    if ($restockRequest) {
                        InventoryRestockRequestItem::query()
                            ->where('request_id', $restockRequest->id)
                            ->where('ingredient_id', $item['ingredient_id'])
                            ->update(['approved_quantity' => $item['quantity'], 'updated_at' => now()]);
                    }
                }
                if ($restockRequest) {
                    $restockRequest->update([
                        'status' => 'fulfilled',
                        'reviewed_by' => $request->user()?->id,
                    ]);
                }

                return $transfer->load('items.ingredient:id,name,unit');
            });
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $transfer], 201);
    }

    public function import(Request $request, InventoryService $inventory)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'The CSV file could not be read.'], 422);
        }

        $header = fgetcsv($handle);
        $expected = ['name', 'category', 'unit', 'quantity', 'reorder_level', 'unit_cost'];
        $columns = $header ? array_map(fn ($value) => strtolower(trim((string) $value)), $header) : [];
        $optionalColumns = array_slice($columns, count($expected));
        if (array_slice($columns, 0, count($expected)) !== $expected
            || count($columns) > count($expected) + 3
            || array_diff($optionalColumns, ['total_price_paid', 'supplier', 'notes'])
            || count($columns) !== count(array_unique($columns))) {
            fclose($handle);

            return response()->json([
                'message' => 'The CSV header must start with: '.implode(',', $expected).' and may include supplier and notes.',
                'errors' => ['file' => ['Invalid CSV header.']],
            ], 422);
        }

        $rows = [];
        $errors = [];
        $seenNames = [];
        $line = 1;
        while (($values = fgetcsv($handle)) !== false) {
            $line++;
            if ($values === [null] || $values === []) {
                continue;
            }
            if (count($values) > count($columns)) {
                $errors[] = ['row' => $line, 'errors' => ['Row contains more values than the CSV header.']];
                continue;
            }
            $row = array_fill_keys($columns, '');
            foreach ($columns as $index => $column) {
                $row[$column] = $values[$index] ?? '';
            }
            $validator = validator($row, [
                'name' => [
                    'required',
                    'string',
                    'min:'.config('input_limits.ingredient_name.min'),
                    'max:'.config('input_limits.ingredient_name.max'),
                    'regex:'.config('input_limits.ingredient_name.pattern'),
                ],
                'category' => ['required', 'string', Rule::in(self::CATEGORIES)],
                'unit' => ['required', 'string', Rule::in($this->inventoryUnits())],
                'quantity' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
                'reorder_level' => 'required|numeric|min:0|max:'.config('input_limits.inventory_quantity'),
                'unit_cost' => 'nullable|numeric|min:0|max:999999999.99',
                'total_price_paid' => ['nullable', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0', 'max:'.config('inventory.max_total_price_paid')],
                'supplier' => 'nullable|string|max:180',
                'notes' => 'nullable|string|max:'.config('input_limits.long_text'),
            ]);
            if ($validator->fails()) {
                $errors[] = ['row' => $line, 'errors' => $validator->errors()->all()];
                continue;
            }
            if (($row['total_price_paid'] ?? '') !== '' && bccomp((string) $row['quantity'], '0', 3) <= 0) {
                $errors[] = ['row' => $line, 'errors' => ['Enter a quantity before adding a total price.']];
                continue;
            }
            $normalizedName = mb_strtolower(trim($row['name']));
            if (isset($seenNames[$normalizedName])
                || MainBranchIngredient::query()->whereRaw('LOWER(name) = ?', [$normalizedName])->exists()) {
                $errors[] = ['row' => $line, 'errors' => ['Ingredient name already exists.']];
                continue;
            }
            $seenNames[$normalizedName] = true;
            $rows[] = ['line' => $line, 'values' => $row];
        }
        fclose($handle);

        $imported = 0;
        foreach ($rows as $entry) {
            $row = $entry['values'];
            try {
                DB::transaction(function () use ($row, $request, $inventory) {
                    $supplierName = trim((string) ($row['supplier'] ?? ''));
                    $supplierId = null;
                    if ($supplierName !== '') {
                        $supplier = InventorySupplier::query()
                            ->whereRaw('LOWER(name) = ?', [mb_strtolower($supplierName)])
                            ->first();
                        $supplier ??= InventorySupplier::create(['name' => $supplierName]);
                        $supplierId = $supplier->id;
                    }
                    $ingredient = MainBranchIngredient::create([
                        'name' => trim($row['name']),
                        'category' => $row['category'],
                        'unit' => $row['unit'],
                        'purchase_unit' => $row['unit'],
                        'conversion_factor' => 1,
                        'quantity' => 0,
                        'reorder_level' => $row['reorder_level'],
                        'unit_cost' => ($row['total_price_paid'] ?? '') !== ''
                            ? null
                            : ($row['unit_cost'] === '' ? null : $row['unit_cost']),
                        'supplier_id' => $supplierId,
                        'notes' => $row['notes'] ?? null,
                    ]);
                    if ((float) $row['quantity'] > 0) {
                        $inventory->move(
                            $ingredient->id,
                            'opening_stock',
                            (float) $row['quantity'],
                            'CSV import opening stock',
                            $request->user(),
                            ($row['total_price_paid'] ?? '') === '' ? [] : [
                                'total_cost' => InventoryCosting::normalizeMoney($row['total_price_paid']),
                                'unit_cost' => InventoryCosting::unitCost($row['total_price_paid'], (string) $row['quantity'], 4),
                            ],
                        );
                    }
                });
                $imported++;
            } catch (\Throwable $exception) {
                report($exception);
                $errors[] = ['row' => $entry['line'], 'errors' => ['Unable to import this row.']];
            }
        }

        return response()->json([
            'data' => ['imported' => $imported, 'errors' => $errors],
        ]);
    }

    public function export()
    {
        $ingredients = MainBranchIngredient::query()->with('supplierRelation:id,name')->where('is_archived', false)->orderBy('name')->get();

        return response()->streamDownload(function () use ($ingredients) {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['name', 'category', 'unit', 'quantity', 'reorder_level', 'unit_cost', 'total_price_paid', 'supplier', 'notes']);
            foreach ($ingredients as $ingredient) {
                fputcsv($output, [
                    $ingredient->name,
                    $ingredient->category,
                    $ingredient->unit,
                    $ingredient->quantity,
                    $ingredient->reorder_level,
                    $ingredient->unit_cost,
                    (float) $ingredient->quantity > 0
                        ? InventoryCosting::currentValue(
                            $ingredient->inventory_value === null ? null : (string) $ingredient->inventory_value,
                            (string) $ingredient->quantity,
                            $ingredient->unit_cost === null ? null : (string) $ingredient->unit_cost,
                        )
                        : null,
                    $ingredient->supplierRelation?->name ?? $ingredient->supplier,
                    $ingredient->notes,
                ]);
            }
            fclose($output);
        }, 'ingredients.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function recipes(InventoryService $inventory)
    {
        $products = Product::query()->orderBy('name')->get(['id', 'name', 'price', 'franchise_id']);
        $recipes = IngredientRecipe::query()
            ->with('ingredient:id,name,unit,quantity,unit_cost,inventory_value')
            ->get()
            ->groupBy('product_id');
        foreach ($recipes as $productRecipes) {
            foreach ($productRecipes as $recipe) {
                $ingredient = $recipe->ingredient;
                if ($ingredient && $ingredient->inventory_value !== null && (float) $ingredient->quantity > 0) {
                    $ingredient->setAttribute(
                        'average_unit_cost',
                        InventoryCosting::unitCost((string) $ingredient->inventory_value, (string) $ingredient->quantity, 4),
                    );
                }
            }
        }

        return response()->json([
            'data' => [
                'products' => $products->map(fn (Product $product) => [
                    'product' => $product,
                    'recipes' => $recipes->get($product->id, collect())->values(),
                    'can_make' => $inventory->availablePortions($product->id),
                ])->values(),
                'ingredients' => MainBranchIngredient::query()->where('is_archived', false)->orderBy('name')->get(['id', 'name', 'unit']),
            ],
        ]);
    }

    public function saveRecipes(Request $request, Product $product, InventoryService $inventory)
    {
        $validated = $request->validate([
            'recipes' => 'required|array|max:100',
            'recipes.*.ingredient_id' => 'required|integer|distinct|exists:main_branch_ingredients,id',
            'recipes.*.quantity' => 'required|numeric|gt:0|max:'.config('input_limits.inventory_quantity'),
            'recipes.*.unit' => ['required', 'string', Rule::in($this->inventoryUnits())],
        ]);

        foreach ($validated['recipes'] as $recipe) {
            $ingredient = MainBranchIngredient::findOrFail($recipe['ingredient_id']);
            if ($ingredient->unit !== $recipe['unit']) {
                return response()->json(['message' => "Recipe unit for {$ingredient->name} must match its usage unit ({$ingredient->unit})."], 422);
            }
        }

        DB::transaction(function () use ($validated, $product, $inventory) {
            IngredientRecipe::query()->where('product_id', $product->id)->delete();
            foreach ($validated['recipes'] as $recipe) {
                IngredientRecipe::create([
                    'product_id' => $product->id,
                    ...$recipe,
                ]);
            }

            foreach (Franchise::query()->get(['id']) as $branch) {
                $branchId = (string) $branch->id;
                $available = $inventory->availablePortions($product->id, $branchId);
                \App\Models\FranchiseInventory::query()->updateOrCreate(
                    ['franchise_id' => $branchId, 'product_id' => $product->id],
                    ['ingredient_unavailable' => $available === 0],
                );
            }
        });

        return response()->json(['data' => ['product_id' => $product->id, 'saved' => true]]);
    }

    public function reports(Request $request)
    {
        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);
        $movements = MainBranchStockMovement::query()
            ->when($validated['from'] ?? null, fn ($query, $date) => $query->whereDate('occurred_at', '>=', $date))
            ->when($validated['to'] ?? null, fn ($query, $date) => $query->whereDate('occurred_at', '<=', $date))
            ->get();

        $sales = DB::table('orders')
            ->whereNotIn('status', ['cancelled', 'failed'])
            ->when($validated['from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($validated['to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->get(['items', 'total']);
        $productSales = [];
        foreach ($sales as $sale) {
            foreach ((array) json_decode((string) $sale->items, true) as $item) {
                $id = $item['product_id'] ?? null;
                if (! $id) {
                    continue;
                }
                $productSales[$id] = ($productSales[$id] ?? 0) + (float) ($item['product_price'] ?? 0) * (int) ($item['quantity'] ?? 0);
            }
        }

        $foodCosts = [];
        foreach (IngredientRecipe::query()->with('ingredient:id,quantity,unit_cost,inventory_value')->get() as $recipe) {
            $ingredient = $recipe->ingredient;
            if ($ingredient?->inventory_value !== null && (float) $ingredient->quantity > 0) {
                $unitCost = InventoryCosting::unitCost((string) $ingredient->inventory_value, (string) $ingredient->quantity, 8);
            } else {
                $unitCost = $ingredient?->unit_cost;
            }
            if ($unitCost === null) {
                continue;
            }
            $foodCosts[$recipe->product_id] = bcadd(
                $foodCosts[$recipe->product_id] ?? '0',
                bcmul((string) $recipe->quantity, (string) $unitCost, 8),
                8,
            );
        }
        $products = Product::query()->get(['id', 'name', 'price'])->map(function (Product $product) use ($foodCosts, $productSales) {
            $foodCost = $foodCosts[$product->id] ?? 0;
            $price = (float) $product->price;

            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sales' => round($productSales[$product->id] ?? 0, 2),
                'ingredient_cost_per_portion' => InventoryCosting::roundMoney((string) $foodCost),
                'food_cost_percent' => $price > 0 ? round((float) $foodCost / $price * 100, 2) : null,
            ];
        });

        return response()->json([
            'data' => [
                'ingredient_usage' => $movements->where('type', 'order_usage')->groupBy('ingredient_id')->map(fn ($items) => [
                    'ingredient_name' => $items->first()->ingredient_name,
                    'quantity' => round($items->sum(fn ($movement) => abs((float) $movement->quantity_change)), 3),
                    'unit' => $items->first()->unit,
                ])->values(),
                'waste' => $movements->where('type', 'waste')->groupBy('ingredient_id')->map(fn ($items) => [
                    'ingredient_name' => $items->first()->ingredient_name,
                    'quantity' => round($items->sum(fn ($movement) => abs((float) $movement->quantity_change)), 3),
                    'unit' => $items->first()->unit,
                ])->values(),
                'variance' => $movements->where('type', 'count_adjustment')->map(fn ($movement) => [
                    'ingredient_name' => $movement->ingredient_name,
                    'variance' => $movement->quantity_change,
                    'unit' => $movement->unit,
                    'reason' => $movement->reason,
                    'occurred_at' => $movement->occurred_at,
                ])->values(),
                'inventory_value' => $this->exactInventoryValue(
                    MainBranchIngredient::query()->where('is_archived', false)->get(['quantity', 'unit_cost', 'inventory_value']),
                ),
                'food_cost_by_product' => $products->values(),
            ],
        ]);
    }

    private function ensureUniqueName(string $name, ?int $exceptId = null): void
    {
        $query = MainBranchIngredient::query()->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($name))]);
        if ($exceptId !== null) {
            $query->whereKeyNot($exceptId);
        }
        if ($query->exists()) {
            abort(response()->json([
                'message' => 'An ingredient with this name already exists.',
                'errors' => ['name' => ['An ingredient with this name already exists.']],
            ], 422));
        }
    }

    private function calculateSummary(Collection $ingredients): array
    {
        $total = $ingredients->count();
        $outOfStock = $ingredients->filter(fn ($item) => (float) ($item->usable_quantity ?? $item->quantity) <= 0)->count();
        $lowStock = $ingredients->filter(fn ($item) =>
            (float) ($item->usable_quantity ?? $item->quantity) > 0
                && (float) ($item->usable_quantity ?? $item->quantity) <= (float) $item->reorder_level
        )->count();
        $stockValue = $this->exactInventoryValue($ingredients);

        return [
            'total' => $total,
            'low_stock' => $lowStock,
            'out_of_stock' => $outOfStock,
            'needs_restocking' => $lowStock + $outOfStock,
            'stock_value' => $stockValue,
        ];
    }

    private function exactInventoryValue(iterable $ingredients): string
    {
        $total = '0.00';
        foreach ($ingredients as $ingredient) {
            $value = InventoryCosting::currentValue(
                $ingredient->inventory_value === null ? null : (string) $ingredient->inventory_value,
                (string) $ingredient->quantity,
                $ingredient->unit_cost === null ? null : (string) $ingredient->unit_cost,
            );
            $total = bcadd($total, $value ?? '0.00', 2);
        }

        return $total;
    }

    private function attachUsableQuantities(Collection $ingredients): void
    {
        if (! Schema::hasTable('stock_batches') || ! Schema::hasColumn('stock_batches', 'ingredient_id')) {
            foreach ($ingredients as $ingredient) {
                $ingredient->setAttribute('usable_quantity', max(0, (float) $ingredient->quantity));
            }

            return;
        }

        $expiredByIngredient = StockBatch::query()
            ->whereNull('branch_id')
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', now()->toDateString())
            ->selectRaw('ingredient_id, SUM(quantity_remaining) as expired_quantity')
            ->groupBy('ingredient_id')
            ->pluck('expired_quantity', 'ingredient_id');

        foreach ($ingredients as $ingredient) {
            $ingredient->setAttribute(
                'usable_quantity',
                max(0, round((float) $ingredient->quantity - (float) $expiredByIngredient->get($ingredient->id, 0), 3)),
            );
        }
    }
}
