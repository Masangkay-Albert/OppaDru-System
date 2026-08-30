<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\SystemSetting;

class PricingService
{
    public function settings(): array
    {
        return [
            'delivery_base_fee' => $this->setting('delivery_base_fee', 49),
            'delivery_base_distance_km' => $this->setting('delivery_base_distance_km', 3),
            'delivery_per_km_rate' => $this->setting('delivery_per_km_rate', 10),
            'delivery_free_subtotal' => $this->setting('delivery_free_subtotal', 999),
            'delivery_max_fee' => $this->setting('delivery_max_fee', 150),
            'service_fee_rate' => $this->setting('service_fee_rate', 0.03, 4),
            'service_fee_min' => $this->setting('service_fee_min', 15),
            'service_fee_max' => $this->setting('service_fee_max', 80),
            'merchant_latitude' => $this->setting('merchant_latitude', 14.329, 6),
            'merchant_longitude' => $this->setting('merchant_longitude', 120.936, 6),
            'vat_rate' => 0.12,
        ];
    }

    public function calculate(array $items, string $deliveryType = 'standard', float $voucherDiscount = 0, float $discountRate = 0, ?array $deliveryCoordinates = null): array
    {
        $productIds = collect($items)->pluck('product_id')->filter()->unique();
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');
        $subtotal = 0;
        foreach ($items as $item) {
            $product = $products->get($item['product_id'] ?? null);
            if (!$product || (int) ($item['quantity'] ?? 0) < 1) {
                throw new \InvalidArgumentException('One or more order items are invalid.');
            }
            $allowedGroupIds = AddonGroup::where('is_active', true)
                ->where(function ($query) use ($product) {
                    $query->whereJsonContains('applicable_categories', $product->category)
                        ->orWhereHas('products', fn ($products) => $products->where('products.id', $product->id));
                })->pluck('id');
            $addonIds = collect($item['selected_addons'] ?? [])->pluck('id')->filter();
            $selectedAddons = Addon::whereIn('id', $addonIds)
                ->whereIn('addon_group_id', $allowedGroupIds)
                ->where('is_active', true)
                ->get()->keyBy('id');
            if ($selectedAddons->count() !== $addonIds->unique()->count()) {
                throw new \InvalidArgumentException('One or more selected add-ons are unavailable for this item.');
            }
            $addons = collect($item['selected_addons'] ?? [])->sum(function (array $addon) use ($selectedAddons) {
                $quantity = max(1, (int) ($addon['quantity'] ?? 1));
                return (float) $selectedAddons->get($addon['id'])->price * $quantity;
            });
            $subtotal += ((float) $product->price + $addons) * (int) $item['quantity'];
        }

        $settings = $this->settings();
        $deliveryDistanceKm = $this->distanceInKilometers($deliveryCoordinates, $settings);
        // Always calculate distance-based delivery fee (no free delivery threshold)
        $deliveryFee = min(
            $settings['delivery_max_fee'],
            max(0, $settings['delivery_base_fee'] + max(0, $deliveryDistanceKm - $settings['delivery_base_distance_km']) * $settings['delivery_per_km_rate'])
        );
        $serviceFee = min($settings['service_fee_max'], max($settings['service_fee_min'], $subtotal * $settings['service_fee_rate']));
        $priorityFee = strtolower($deliveryType) === 'priority' ? 99.0 : 0.0;
        $discountAmount = round(($subtotal + $deliveryFee + $serviceFee + $priorityFee) * max(0, $discountRate), 2);
        $afterDiscount = max(0, $subtotal + $deliveryFee + $serviceFee + $priorityFee - $discountAmount - max(0, $voucherDiscount));
        $vat = round($afterDiscount * $settings['vat_rate'], 2);
        $total = round($afterDiscount + $vat, 2);

        return compact('subtotal', 'deliveryFee', 'serviceFee', 'priorityFee', 'deliveryDistanceKm', 'discountAmount', 'vat', 'total') + [
            'deliveryCalculationMethod' => 'base_fee_plus_distance_rate_capped',
            'serviceFeeRule' => 'clamped_percentage:' . ($settings['service_fee_rate'] * 100) . '%_min_' . $settings['service_fee_min'] . '_max_' . $settings['service_fee_max'],
        ];
    }

    private function distanceInKilometers(?array $coordinates, array $settings): float
    {
        if (!$coordinates || !isset($coordinates['lat'], $coordinates['lng'])) {
            return 0.0;
        }

        $earthRadiusKm = 6371;
        $latitudeDelta = deg2rad((float) $coordinates['lat'] - $settings['merchant_latitude']);
        $longitudeDelta = deg2rad((float) $coordinates['lng'] - $settings['merchant_longitude']);
        $latitude = deg2rad($settings['merchant_latitude']);
        $destinationLatitude = deg2rad((float) $coordinates['lat']);
        $a = sin($latitudeDelta / 2) ** 2 + cos($latitude) * cos($destinationLatitude) * sin($longitudeDelta / 2) ** 2;

        return round($earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a)), 3);
    }

    private function setting(string $key, float $default, int $decimals = 2): float
    {
        return round((float) (SystemSetting::where('key', $key)->value('value') ?? $default), $decimals);
    }
}