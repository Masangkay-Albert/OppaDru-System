<?php

namespace App\Services\Order;

use App\Models\Addon;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Product;

class OrderDataService
{
    public function convertToPhilippineTime($timestamp): ?string
    {
        if (!$timestamp) {
            return null;
        }

        $date = new \DateTime($timestamp);
        $date->setTimezone(new \DateTimeZone('Asia/Manila'));

        return $date->format('Y-m-d\TH:i:sP');
    }

    public function formatOrder(Order $order): array
    {
        $createdAt = $order->created_at ? $order->created_at->toISOString() : null;

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'email' => $order->email,
            'customer_name' => $order->user ? $order->user->full_name : 'Guest',
            'user_id' => $order->user_id,
            'total' => $order->total,
            'status' => $order->status,
            'payment_method' => $order->payment_method,
            'delivery_address' => $order->delivery_address,
            'delivery_coordinates' => $order->delivery_coordinates,
            'phone' => $order->phone,
            'items' => $order->items,
            'order_items' => $order->orderItems,
            'delivery_type' => $order->delivery_type ?? ($order->priority_fee > 0 ? 'priority' : 'standard'),
            'delivery_fee' => $order->delivery_fee,
            'delivery_distance_km' => $order->delivery_distance_km,
            'delivery_calculation_method' => $order->delivery_calculation_method,
            'service_fee' => $order->service_fee,
            'priority_fee' => $order->priority_fee,
            'vat' => $order->vat,
            'service_fee_rule' => $order->service_fee_rule,
            'scheduled_at' => $order->scheduled_at ? $this->convertToPhilippineTime($order->scheduled_at) : null,
            'scheduled_date' => $order->scheduled_date,
            'scheduled_time' => $order->scheduled_time,
            'schedule_display' => $order->schedule_display,
            'schedule_window' => $order->schedule_window,
            'created_at' => $createdAt ? $this->convertToPhilippineTime($createdAt) : null,
            'timestamp' => $createdAt ? $this->convertToPhilippineTime($createdAt) : null,
        ];
    }

    public function formatOrders($orders): array
    {
        return $orders->map(fn (Order $order) => $this->formatOrder($order))->all();
    }

    public function buildOrderItems(array $items): array
    {
        $orderItems = [];

        foreach ($items as $item) {
            $product = Product::find($item['product_id']);
            $addonIds = collect($item['selected_addons'] ?? [])->pluck('id')->filter();
            $addons = Addon::whereIn('id', $addonIds)->get()->keyBy('id');
            $selectedAddons = collect($item['selected_addons'] ?? [])->map(function ($addon) use ($addons) {
                $storedAddon = $addons->get($addon['id'] ?? null);
                if (!$storedAddon) {
                    return null;
                }

                return [
                    'id' => $storedAddon->id,
                    'name' => $storedAddon->name,
                    'price' => (float) $storedAddon->price,
                    'quantity' => max(1, (int) ($addon['quantity'] ?? 1)),
                ];
            })->filter()->values()->all();

            $orderItems[] = [
                'product_id' => $item['product_id'],
                'product_name' => $product?->name ?? $item['product_name'],
                'product_price' => $product?->price ?? (float) ($item['product_price'] ?? 0),
                'quantity' => $item['quantity'],
                'selected_addons' => $selectedAddons,
                'special_instructions' => $item['special_instructions'] ?? null,
            ];
        }

        return $orderItems;
    }

    public function syncOrderItems(Order $order, array $items): void
    {
        $order->orderItems()->delete();

        foreach ($items as $item) {
            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $item['product_id'],
                'product_name' => $item['product_name'],
                'product_price' => $item['product_price'],
                'quantity' => $item['quantity'],
                'special_instructions' => $item['special_instructions'] ?? null,
            ]);

            foreach ($item['selected_addons'] ?? [] as $addon) {
                OrderItemAddon::create([
                    'order_item_id' => $orderItem->id,
                    'addon_id' => $addon['id'] ?? null,
                    'addon_name' => $addon['name'] ?? 'Add-on',
                    'unit_price' => $addon['price'] ?? 0,
                    'quantity' => $addon['quantity'] ?? 1,
                ]);
            }
        }
    }

    public function assertOrderEditable(Order $order): void
    {
        if ($order->status !== 'pending') {
            throw new \InvalidArgumentException('Only pending orders can be edited or cancelled.');
        }

        $createdAt = $order->created_at;
        $now = now();
        $elapsedSeconds = $createdAt ? abs($createdAt->diffInSeconds($now, false)) : null;

        if (!$createdAt || $createdAt->isFuture() || $elapsedSeconds > 20) {
            throw new \InvalidArgumentException('Order can no longer be cancelled or edited.');
        }
    }
}
