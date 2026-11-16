<?php

namespace App\Services;

use App\Models\Franchise;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReplacementRequest;
use App\Services\Order\OrderDataService;
use Illuminate\Support\Facades\DB;

class OrderReplacementService
{
    public function __construct(
        private readonly OrderDataService $orderDataService,
        private readonly FranchiseInventoryService $franchiseInventoryService,
        private readonly InventoryService $inventoryService,
    ) {}

    /**
     * @param array<int, array{order_item_id: int, product_id: ?string, product_name: string, quantity: int, product_price: float}> $affectedItems
     */
    public function createReplacementOrder(
        Order $original,
        array $affectedItems,
        ?OrderReplacementRequest $replacementRequest = null,
        ?object $actor = null,
    ): Order {
        return DB::transaction(function () use ($original, $affectedItems, $replacementRequest, $actor): Order {
            $original = Order::query()->lockForUpdate()->findOrFail($original->id);
            $branchId = $original->branch_id ?: $original->franchise_id;
            $orderItems = OrderItem::query()
                ->with('addons')
                ->where('order_id', $original->id)
                ->whereIn('id', collect($affectedItems)->pluck('order_item_id'))
                ->get()
                ->keyBy('id');

            if ($orderItems->count() !== count($affectedItems)) {
                abort(422, 'One or more selected items no longer belong to this order.');
            }

            $replacementLines = [];
            $storedAffectedItems = [];
            foreach ($affectedItems as $affected) {
                /** @var OrderItem $sourceItem */
                $sourceItem = $orderItems->get($affected['order_item_id']);
                $quantity = max(1, (int) $affected['quantity']);
                $replacementLines[] = [
                    'product_id' => $sourceItem->product_id,
                    'product_name' => $sourceItem->product_name,
                    'product_price' => 0,
                    'quantity' => $quantity,
                    'selected_addons' => $sourceItem->addons->map(fn ($addon) => [
                        'id' => $addon->addon_id,
                        'name' => $addon->addon_name,
                        'price' => 0,
                        'quantity' => (int) $addon->quantity,
                    ])->values()->all(),
                    'special_instructions' => null,
                ];
                $storedAffectedItems[] = [
                    'order_item_id' => $sourceItem->id,
                    'product_id' => $sourceItem->product_id,
                    'name' => $sourceItem->product_name,
                    'quantity' => $quantity,
                    'unit_price' => (float) $sourceItem->product_price,
                ];
            }

            $replacement = Order::create([
                'franchise_id' => $original->franchise_id ?: $branchId,
                'franchise_account_id' => $original->franchise_account_id,
                'branch_id' => $branchId,
                'email' => $original->email,
                'user_id' => $original->user_id,
                'cashier_employee_id' => $original->cashier_employee_id,
                'franchise_user_id' => $original->franchise_user_id,
                'total' => 0,
                'delivery_type' => $original->delivery_type,
                'delivery_address' => $original->delivery_address,
                'delivery_instructions' => $original->delivery_instructions,
                'delivery_coordinates' => $original->delivery_coordinates,
                'delivery_lat' => $original->delivery_lat,
                'delivery_lng' => $original->delivery_lng,
                'delivery_fee' => 0,
                'delivery_distance_km' => 0,
                'distance_km' => $original->distance_km,
                'delivery_calculation_method' => $original->delivery_calculation_method,
                'service_fee' => 0,
                'priority_fee' => 0,
                'vat' => 0,
                'status' => 'pending',
                'payment_method' => 'replacement',
                'payment_status' => 'paid',
                'phone' => $original->phone,
                'items' => $replacementLines,
                'include_cutlery' => false,
                'fulfillment_type' => $original->fulfillment_type,
                'special_instructions' => 'REPLACEMENT for '.$original->order_number,
                'replacement_of_order_id' => $original->id,
            ]);

            $this->orderDataService->syncOrderItems($replacement, $replacementLines);
            if ($replacement->branch_id) {
                $branch = Franchise::query()->find($replacement->branch_id);
                if ($branch && ! $branch->is_main) {
                    $this->franchiseInventoryService->consume(
                        (string) $replacement->branch_id,
                        $replacementLines,
                    );
                }
            }
            $this->inventoryService->deductForOrder($replacement);

            if ($replacementRequest) {
                $replacementRequest->update([
                    'status' => 'approved',
                    'affected_items' => $storedAffectedItems,
                    'handled_by' => $actor ? (string) $actor->getAuthIdentifier() : null,
                    'handled_at' => now(),
                    'replacement_order_id' => $replacement->id,
                ]);
            }

            return $replacement->fresh(['orderItems']);
        });
    }

    public function itemPayload(Order $order, array $itemIds): array
    {
        $items = OrderItem::query()
            ->where('order_id', $order->id)
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        if ($items->count() !== count(array_unique($itemIds))) {
            abort(422, 'Choose items from this order.');
        }

        return $items->map(fn (OrderItem $item) => [
            'order_item_id' => (int) $item->id,
            'product_id' => $item->product_id,
            'name' => $item->product_name,
            'quantity' => (int) $item->quantity,
            'unit_price' => (float) $item->product_price,
        ])->values()->all();
    }
}
