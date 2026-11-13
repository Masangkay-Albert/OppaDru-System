<?php

namespace App\Http\Controllers;

use App\Models\BranchIngredientStock;
use App\Models\InventoryRestockRequest;
use App\Models\InventoryRestockRequestItem;
use App\Models\InventoryTransfer;
use App\Models\MainBranchIngredient;
use App\Models\StockBatch;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BranchInventoryController extends Controller
{
    public function index(Request $request, InventoryService $inventory)
    {
        $branchId = (string) $request->user()->franchise_id;
        $stocks = BranchIngredientStock::query()
            ->with('ingredient:id,name,category,unit,unit_cost,reorder_level')
            ->where('branch_id', $branchId)
            ->get()
            ->keyBy('ingredient_id');

        $ingredients = MainBranchIngredient::query()
            ->where('is_archived', false)
            ->orderBy('name')
            ->get()
            ->map(function (MainBranchIngredient $ingredient) use ($stocks, $inventory, $branchId) {
                $stock = $stocks->get($ingredient->id);
                $usableQuantity = $inventory->availableQuantity($ingredient->id, $branchId);

                return [
                    'id' => $ingredient->id,
                    'name' => $ingredient->name,
                    'category' => $ingredient->category,
                    'unit' => $ingredient->unit,
                    'quantity' => $stock?->quantity ?? '0.000',
                    'usable_quantity' => $usableQuantity,
                    'reorder_level' => $stock?->reorder_level ?? $ingredient->reorder_level,
                    'unit_cost' => $stock?->unit_cost ?? $ingredient->unit_cost,
                    'status' => ! $stock || $usableQuantity <= 0
                        ? 'out_of_stock'
                        : ($usableQuantity <= (float) ($stock->reorder_level ?? $ingredient->reorder_level) ? 'low_stock' : 'in_stock'),
                ];
            });
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
                'ingredients' => $ingredients,
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

    public function adjust(Request $request, MainBranchIngredient $ingredient, InventoryService $inventory)
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['stock_in', 'stock_out', 'waste', 'adjustment', 'count_adjustment'])],
            'quantity' => 'required|numeric|min:0|max:999999999.999',
            'reason' => 'nullable|string|max:2000',
        ]);
        if (in_array($validated['type'], ['adjustment', 'count_adjustment', 'waste'], true)) {
            $request->validate(['reason' => 'required|string|max:2000']);
        }

        try {
            if (in_array($validated['type'], ['adjustment', 'count_adjustment'], true)) {
                $inventory->setBranchQuantity(
                    (string) $request->user()->franchise_id,
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

    public function requestRestock(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1|max:100',
            'items.*.ingredient_id' => ['required', 'integer', 'distinct', Rule::exists('main_branch_ingredients', 'id')->where('is_archived', false)],
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
}
