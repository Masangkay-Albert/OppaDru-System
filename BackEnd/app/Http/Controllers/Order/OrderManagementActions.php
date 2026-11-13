<?php

namespace App\Http\Controllers\Order;

use App\Models\Order;
use App\Models\Promo;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

trait OrderManagementActions
{
    public function updateStatusOnsite(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,preparing,prepared,ready,delivered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        return DB::transaction(function () use ($request, $id) {
            $order = Order::query()->lockForUpdate()->findOrFail($id);
            $order->status = $request->status;
            $order->save();
            if ($request->status === 'cancelled') {
                app(\App\Services\InventoryService::class)->reverseOrder($order, $request->user());
            }

            return response()->json([
                'success' => true,
                'order' => $order,
                'message' => 'Order status updated successfully!',
            ]);
        });
    }

    public function update(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        if ($order->status !== 'pending') {
            return response()->json(['message' => 'Only pending orders can be edited or cancelled.'], 422);
        }

        $createdAt = $order->created_at;
        $now = now();
        $elapsedSeconds = $createdAt ? abs($createdAt->diffInSeconds($now, false)) : null;

        if (! $createdAt || $createdAt->isFuture() || $elapsedSeconds > 20) {
            return response()->json([
                'message' => 'Order can no longer be cancelled or edited.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.product_name' => 'required|string',
            'items.*.product_price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_addons' => 'nullable|array',
            'delivery_address' => 'nullable|string',
            'phone' => 'nullable|string',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $pricing = app(PricingService::class)->calculate(
            $request->items,
            $request->input('delivery_type', $order->delivery_type ?? 'standard'),
            0,
            0,
            $request->input('delivery_coordinates') ?? null
        );

        $order->fill([
            'items' => $request->items,
            'delivery_address' => $request->input('delivery_address', $order->delivery_address),
            'phone' => $request->input('phone', $order->phone),
            'delivery_type' => $request->input('delivery_type', $order->delivery_type ?? 'standard'),
            'total' => $pricing['total'],
            'delivery_fee' => $pricing['deliveryFee'],
            'delivery_distance_km' => $pricing['deliveryDistanceKm'],
            'delivery_calculation_method' => $pricing['deliveryCalculationMethod'],
            'service_fee' => $pricing['serviceFee'],
            'priority_fee' => $pricing['priorityFee'],
            'vat' => $pricing['vat'],
            'service_fee_rule' => $pricing['serviceFeeRule'],
        ]);
        $order->save();

        $this->orderDataService->syncOrderItems($order, $request->items);

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Order updated successfully.',
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        return DB::transaction(function () use ($request, $id) {
            $order = Order::query()->lockForUpdate()->findOrFail($id);

            if ($order->email !== $request->user()->email) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }

            $createdAt = $order->created_at;
            $now = now();
            $elapsedMilliseconds = $createdAt
                ? (($now->getTimestamp() * 1000) + (int) $now->format('v'))
                    - (($createdAt->getTimestamp() * 1000) + (int) $createdAt->format('v'))
                : null;
            $cancellationWindow = (int) config('orders.customer_cancellation_window_seconds', 30);
            if ($order->status !== 'pending') {
                return response()->json([
                    'message' => 'This order has already started and can no longer be cancelled.',
                ], 422);
            }

            if (
                ! $createdAt
                || $elapsedMilliseconds < 0
                || $elapsedMilliseconds >= $cancellationWindow * 1000
            ) {
                return response()->json([
                    'message' => 'Cancellation period has ended.',
                ], 422);
            }

            $order->status = 'cancelled';
            $order->save();
            app(\App\Services\InventoryService::class)->reverseOrder($order, $request->user());

            if ($order->promo_id) {
                Promo::query()
                    ->whereKey($order->promo_id)
                    ->where('times_used', '>', 0)
                    ->decrement('times_used');
            }

            return response()->json([
                'success' => true,
                'order' => $order,
                'message' => 'Order cancelled successfully.',
            ]);
        });
    }
}
