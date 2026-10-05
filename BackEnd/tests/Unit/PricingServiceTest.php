<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\Addon;
use App\Models\AddonGroup;
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

        $this->assertSame(44.0, $pricing['vat']);
        $this->assertSame(479.0, $pricing['total']);
    }

    public function test_included_vat_scales_with_product_quantity_without_being_added_to_total(): void
    {
        $pricing = $this->calculateFor(415, null, 2);

        $this->assertSame(89.0, $pricing['vat']);
        $this->assertSame(904.0, $pricing['total']);
    }

    public function test_priority_delivery_adds_ninety_nine_pesos_without_changing_included_vat(): void
    {
        $standard = $this->calculateFor(415);
        $priority = $this->calculateFor(415, null, 1, 'priority');

        $this->assertSame(99.0, $priority['priorityFee']);
        $this->assertSame($standard['total'] + 99.0, $priority['total']);
        $this->assertSame($standard['vat'], $priority['vat']);
    }

    public function test_size_and_addon_quantities_are_included_in_the_server_total(): void
    {
        $sizedProduct = Product::create([
            'name' => 'Sized drink',
            'description' => 'Drink',
            'price' => 100,
            'category' => 'fruity-soda-milk',
            'image' => '',
            'is_available' => true,
        ]);
        $addonGroup = AddonGroup::create([
            'name' => 'Extra topping',
            'selection_type' => 'multiple',
            'supports_quantity' => true,
            'applicable_categories' => ['fruity-soda-milk'],
            'is_active' => true,
        ]);
        $addon = Addon::create([
            'addon_group_id' => $addonGroup->id,
            'name' => 'Jelly',
            'price' => 11,
            'is_active' => true,
        ]);

        $pricing = app(PricingService::class)->calculate([[
            'product_id' => $sizedProduct->id,
            'quantity' => 3,
            'selected_size' => 'Small',
            'selected_addons' => [['id' => $addon->id, 'quantity' => 2]],
        ]]);

        $this->assertSame(336.0, $pricing['subtotal']);
        $this->assertSame(400.0, $pricing['total']);
    }

    public function test_all_components_are_rounded_before_calculating_the_total(): void
    {
        $standard = $this->calculateFor(866, null, 1, 'standard', 12.6, 0.20);
        $priority = $this->calculateFor(866, null, 1, 'priority', 12.6, 0.20);

        $this->assertSame(866.0, $standard['subtotal']);
        $this->assertSame(49.0, $standard['deliveryFee']);
        $this->assertSame(26.0, $standard['serviceFee']);
        $this->assertSame(188.0, $standard['discountAmount']);
        $this->assertSame(93.0, $standard['vat']);
        $this->assertSame(93.0, $priority['vat']);
        $this->assertSame(740.0, $standard['total']);
        $this->assertSame(819.0, $priority['total']);
    }

    public function test_legacy_decimal_subtotals_are_whole_peso_in_new_pricing_results(): void
    {
        $pricing = $this->calculateFor(415.50);

        $this->assertSame(416.0, $pricing['subtotal']);
        $this->assertSame(45.0, $pricing['vat']);
        $this->assertSame(480.0, $pricing['total']);
    }

    private function calculateFor(
        float $price,
        ?array $coordinates = null,
        int $quantity = 1,
        string $deliveryType = 'standard',
        float $voucherDiscount = 0,
        float $discountRate = 0,
    ): array
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
        ]], $deliveryType, $voucherDiscount, $discountRate, $coordinates);
    }
}