<?php

namespace App\Services\Order;

use App\Models\Addon;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\Product;
use App\Services\FranchiseInventoryService;

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
        $cancellationWindow = (int) config('orders.customer_cancellation_window_seconds', 30);
        $now = now();
        $cancellationElapsedMilliseconds = $order->created_at
            ? (($now->getTimestamp() * 1000) + (int) $now->format('v'))
                - (($order->created_at->getTimestamp() * 1000) + (int) $order->created_at->format('v'))
            : ($cancellationWindow * 1000);
        $cancellationRemaining = strtolower((string) $order->status) === 'pending'
            ? max(0, (($cancellationWindow * 1000) - max(0, $cancellationElapsedMilliseconds)) / 1000)
            : 0;

        $baseUrl = (function_exists('request') && request()?->hasHeader('host'))
            ? rtrim(request()->root(), '/')
            : rtrim(config('app.url'), '/');

        $proofImage = $order->delivery_proof_image;
        $proofUrl = $this->resolveImageUrl($proofImage, $baseUrl);
        $discountProofImage = $order->discount_proof_image;

        $branch = $order->branch_id
            ? ($order->relationLoaded('branch') ? $order->branch : $order->branch()->first())
            : $order->franchise;

        $driver = $order->driver_id
            ? ($order->relationLoaded('driver') ? $order->driver : $order->driver()->first())
            : null;

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'email' => $order->email,
            'customer_name' => $order->user
                ? ($order->user->full_name ?? trim(($order->user->first_name ?? '') . ' ' . ($order->user->last_name ?? '')))
                : (preg_match('/Customer:\s*([^)|]+)/i', (string) $order->delivery_address, $matches)
                    ? trim($matches[1])
                    : (!empty($order->email) && !str_starts_with($order->email, 'onsite') ? $order->email : 'Guest Customer')),
            'user_id' => $order->user_id,
            'branch_id' => $order->branch_id ?: $order->franchise_id,
            'franchise_id' => $order->franchise_id,
            'franchise_account_id' => $order->franchise_account_id,
            'branch' => $branch ? $branch->only(['id', 'name', 'address', 'latitude', 'longitude']) : null,
            'branch_name' => $branch?->name,
            // Keep the legacy response key for existing clients, but source it
            // from branch_id so it cannot point at a different origin.
            'franchise' => $branch ? $branch->only(['id', 'name', 'address', 'latitude', 'longitude']) : null,
            'total' => $order->total,
            'status' => $order->status,
            'cancellation_remaining_seconds' => $cancellationRemaining,
            'status_history' => $order->status_history ?: [[
                'status' => (string) $order->status,
                'created_at' => $order->created_at?->toIso8601String(),
            ]],
            'channel' => $order->delivery_type === 'onsite' || $order->delivery_calculation_method === 'onsite'
                || str_starts_with(strtolower((string) $order->delivery_address), 'onsite')
                ? 'onsite'
                : 'online',
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'third_party_platform' => $order->third_party_platform,
            'external_order_ref' => $order->external_order_ref,
            'delivery_address' => $order->delivery_address,
            'delivery_instructions' => $order->delivery_instructions,
            'delivery_coordinates' => ($order->delivery_lat !== null && $order->delivery_lng !== null)
                ? ['lat' => (float) $order->delivery_lat, 'lng' => (float) $order->delivery_lng]
                : ($order->delivery_coordinates ?: null),
            'delivery_proof_image' => $proofUrl,
            'delivery_proof_image_url' => $proofUrl,
            'delivery_proof_uploaded_at' => $order->delivery_proof_uploaded_at?->toISOString(),
            'delivery_confirmed_at' => $order->delivery_confirmed_at?->toISOString(),
            'phone' => $order->phone,
            'items' => $order->items,
            'order_items' => $order->orderItems,
            'driver_id' => $order->driver_id,
            'driver' => $driver ? [
                'id' => (string) $driver->id,
                'name' => $driver->name,
                'phone' => $driver->phone,
                'vehicle_type' => $driver->vehicleType ?? $driver->vehicle_type ?? 'Motorcycle',
                'vehicleType' => $driver->vehicleType ?? $driver->vehicle_type ?? 'Motorcycle',
            ] : null,
            'delivery_type' => $order->delivery_type ?? ($order->priority_fee > 0 ? 'priority' : 'standard'),
            'delivery_fee' => $order->delivery_fee,
            'delivery_distance_km' => $order->delivery_distance_km,
            'delivery_calculation_method' => $order->delivery_calculation_method,
            'service_fee' => $order->service_fee,
            'priority_fee' => $order->priority_fee,
            'vat' => $order->vat,
            'service_fee_rule' => $order->service_fee_rule,
            'discount_type' => $order->discount_type,
            'discount_rate' => (float) ($order->discount_rate ?? 0),
            'discount_amount' => (float) ($order->discount_amount ?? 0),
            'promo_id' => $order->promo_id,
            'promo_code' => $order->promo_code,
            'promo_discount' => (float) ($order->promo_discount ?? 0),
            'discount_status' => $order->discount_status ?? 'not_requested',
            'discount_proof_image' => $this->resolveImageUrl($discountProofImage, $baseUrl),
            'discount_rejection_reason' => $order->discount_rejection_reason,
            'discount_requested_at' => $order->discount_requested_at ? $this->convertToPhilippineTime($order->discount_requested_at) : null,
            'discount_reviewed_at' => $order->discount_reviewed_at ? $this->convertToPhilippineTime($order->discount_reviewed_at) : null,
            'scheduled_at' => $order->scheduled_at ? $this->convertToPhilippineTime($order->scheduled_at) : null,
            'is_scheduled' => (bool) ($order->is_scheduled ?? ($order->delivery_type === 'scheduled')),
            'scheduled_for' => $order->scheduled_for
                ? $this->convertToPhilippineTime($order->scheduled_for)
                : ($order->scheduled_at ? $this->convertToPhilippineTime($order->scheduled_at) : null),
            'fulfillment_type' => $order->fulfillment_type ?? 'delivery',
            'special_instructions' => $order->special_instructions,
            'rescheduled_from' => $order->rescheduled_from ? $this->convertToPhilippineTime($order->rescheduled_from) : null,
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

    private function resolveImageUrl(?string $image, string $baseUrl): ?string
    {
        if (!$image) {
            return null;
        }

        if (str_starts_with($image, 'data:image/') || preg_match('/\Ahttps?:\/\//i', $image) || str_starts_with($image, '/')) {
            return $image;
        }

        return $baseUrl . '/storage/' . ltrim($image, '/');
    }

    public function buildOrderItems(array $items, ?string $franchiseId = null): array
    {
        $orderItems = [];
        $productIds = collect($items)
            ->map(fn (array $item) => $item['product_id'] ?? $item['id'] ?? null)
            ->filter()
            ->unique()
            ->values();
        $products = Product::query()->whereIn('id', $productIds)->get()->keyBy('id');
        $branchPrices = $franchiseId
            ? app(FranchiseInventoryService::class)->branchPriceOverrides($franchiseId, $productIds->all())
            : [];

        foreach ($items as $item) {
            $rawProductId = $item['product_id'] ?? ($item['id'] ?? null);
            $product = $rawProductId ? $products->get($rawProductId) : null;
            $addonList = $item['selected_addons'] ?? ($item['selectedAddons'] ?? []);
            $addonIds = collect($addonList)->pluck('id')->filter();
            $addons = Addon::whereIn('id', $addonIds)->get()->keyBy('id');

            $selectedAddons = collect($addonList)->map(function ($addon) use ($addons) {
                $storedAddon = $addons->get($addon['id'] ?? null);
                if ($storedAddon) {
                    return [
                        'id' => $storedAddon->id,
                        'name' => $storedAddon->name,
                        'price' => (float) $storedAddon->price,
                        'quantity' => max(1, (int) ($addon['quantity'] ?? 1)),
                    ];
                }

                if (!empty($addon['name'])) {
                    return [
                        'id' => $addon['id'] ?? null,
                        'name' => $addon['name'],
                        'price' => (float) ($addon['price'] ?? 0),
                        'quantity' => max(1, (int) ($addon['quantity'] ?? 1)),
                    ];
                }

                return null;
            })->filter()->values()->all();

            $orderItems[] = [
                'product_id' => $product?->id ?? $rawProductId,
                'product_name' => $product?->name ?? ($item['product_name'] ?? ($item['name'] ?? 'Item')),
                'product_price' => $product
                    ? ($branchPrices[$product->id] ?? (float) $product->price)
                    : (float) ($item['product_price'] ?? ($item['price'] ?? 0)),
                'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                'selected_addons' => $selectedAddons,
                'selected_size' => $item['selected_size'] ?? null,
                'special_instructions' => $item['special_instructions'] ?? ($item['specialInstructions'] ?? null),
            ];
        }

        return $orderItems;
    }

    public function syncOrderItems(Order $order, array $items): void
    {
        $order->orderItems()->delete();

        foreach ($items as $item) {
            $rawProductId = $item['product_id'] ?? ($item['id'] ?? null);
            $productId = null;
            if (!empty($rawProductId) && Product::where('id', $rawProductId)->exists()) {
                $productId = $rawProductId;
            }

            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $productId,
                'product_name' => $item['product_name'] ?? ($item['name'] ?? 'Item'),
                'product_price' => (float) ($item['product_price'] ?? ($item['price'] ?? 0)),
                'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                'special_instructions' => $item['special_instructions'] ?? ($item['specialInstructions'] ?? null),
            ]);

            $addonList = $item['selected_addons'] ?? ($item['selectedAddons'] ?? []);
            foreach ($addonList as $addon) {
                $addonId = null;
                $rawAddonId = $addon['id'] ?? null;
                if (!empty($rawAddonId) && is_numeric($rawAddonId) && Addon::where('id', $rawAddonId)->exists()) {
                    $addonId = (int) $rawAddonId;
                }

                OrderItemAddon::create([
                    'order_item_id' => $orderItem->id,
                    'addon_id' => $addonId,
                    'addon_name' => $addon['name'] ?? 'Add-on',
                    'unit_price' => (float) ($addon['price'] ?? 0),
                    'quantity' => max(1, (int) ($addon['quantity'] ?? 1)),
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
