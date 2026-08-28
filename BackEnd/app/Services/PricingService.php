<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SystemSetting;

class PricingService
{
    public function settings(): array
    {
        return [
            'service_fee' => $this->setting('service_fee', 29),
            'delivery_fee_standard' => $this->setting('delivery_fee_standard', 49),
            'delivery_fee_priority' => $this->setting('delivery_fee_priority', 99),
            'vat_rate' => 0.12,
        ];
    }

    public function calculate(array $items, string $deliveryType = 'standard', float $voucherDiscount = 0, float $discountRate = 0): array
    {
        $productIds = collect($items)->pluck('product_id')->filter()->unique();
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');
        $subtotal = 0;
        foreach ($items as $item) {
            $product = $products->get($item['product_id'] ?? null);
            if (!$product || (int) ($item['quantity'] ?? 0) < 1) {
                throw new \InvalidArgumentException('One or more order items are invalid.');
            }
            $addons = collect($item['selected_addons'] ?? [])->sum(fn (array $addon) => (float) ($addon['price'] ?? 0));
            $subtotal += ((float) $product->price + $addons) * (int) $item['quantity'];
        }

        $settings = $this->settings();
        $deliveryFee = $deliveryType === 'priority' ? $settings['delivery_fee_priority'] : $settings['delivery_fee_standard'];
        $discountAmount = round(($subtotal + $deliveryFee + $settings['service_fee']) * max(0, $discountRate), 2);
        $afterDiscount = max(0, $subtotal + $deliveryFee + $settings['service_fee'] - $discountAmount - max(0, $voucherDiscount));
        $vat = round($afterDiscount * $settings['vat_rate'], 2);
        $total = round($afterDiscount + $vat, 2);

        return compact('subtotal', 'deliveryFee', 'discountAmount', 'vat', 'total') + ['serviceFee' => $settings['service_fee']];
    }

    private function setting(string $key, float $default): float
    {
        return round((float) (SystemSetting::where('key', $key)->value('value') ?? $default), 2);
    }
}