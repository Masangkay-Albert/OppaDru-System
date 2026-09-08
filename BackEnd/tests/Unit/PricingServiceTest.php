<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_charge_applies_based_on_distance_not_subtotal(): void
    {
        $pricing = $this->calculateFor(999);

        // Delivery always charges based on distance, not subtotal threshold
        $this->assertSame(49.0, $pricing['deliveryFee']);
        $this->assertSame('base_fee_plus_distance_rate_capped', $pricing['deliveryCalculationMethod']);
    }

    public function test_service_fee_uses_minimum_at_lower_boundary(): void
    {
        $pricing = $this->calculateFor(500);

        $this->assertSame(15.0, $pricing['serviceFee']);
    }

    public function test_service_fee_uses_maximum_at_upper_boundary(): void
    {
        $pricing = $this->calculateFor(2666.67);

        $this->assertSame(80.0, $pricing['serviceFee']);
    }

    public function test_zero_distance_uses_base_delivery_fee(): void
    {
        $pricing = $this->calculateFor(100, [
            'lat' => 14.329,
            'lng' => 120.936,
        ]);

        $this->assertSame(0.0, $pricing['deliveryDistanceKm']);
        $this->assertSame(49.0, $pricing['deliveryFee']);
    }

    public function test_very_far_distance_is_capped(): void
    {
        $pricing = $this->calculateFor(100, [
            'lat' => 0,
            'lng' => 0,
        ]);

        $this->assertSame(150.0, $pricing['deliveryFee']);
    }

    public function test_vat_is_reported_as_portion_included_in_product_price(): void
    {
        $pricing = $this->calculateFor(415);

        $this->assertSame(44.46, $pricing['vat']);
        $this->assertSame(479.0, $pricing['total']);
    }

    public function test_included_vat_scales_with_product_quantity_without_being_added_to_total(): void
    {
        $pricing = $this->calculateFor(415, null, 2);

        $this->assertSame(88.93, $pricing['vat']);
        $this->assertSame(903.9, $pricing['total']);
    }

    private function calculateFor(float $price, ?array $coordinates = null, int $quantity = 1): array
    {
        $product = Product::create([
            'name' => 'Test item ' . $price,
            'description' => 'Test item',
            'price' => $price,
            'category' => 'test',
            'image' => 'test.jpg',
            'is_available' => true,
        ]);

        return app(PricingService::class)->calculate([[
            'product_id' => $product->id,
            'quantity' => $quantity,
        ]], 'standard', 0, 0, $coordinates);
    }
}