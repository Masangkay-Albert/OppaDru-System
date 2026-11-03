<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Franchise;
use App\Models\FranchiseInventory;
use App\Models\SystemSetting;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_load_all_values_in_one_query_and_use_defaults_for_missing_values(): void
    {
        SystemSetting::create(['key' => 'delivery_base_fee', 'value' => '75.00']);
        $queries = 0;
        DB::listen(function ($query) use (&$queries) {
            if (str_contains(strtolower($query->sql), 'system_settings')) {
                $queries++;
            }
        });

        $settings = app(PricingService::class)->settings();

        $this->assertSame(75.0, $settings['delivery_base_fee']);
        $this->assertSame(3.0, $settings['delivery_base_distance_km']);
        $this->assertSame(1, $queries);
    }

    public function test_settings_reflect_database_updates_after_cache_invalidation(): void
    {
        SystemSetting::create(['key' => 'delivery_base_fee', 'value' => '75.00']);
        $service = app(PricingService::class);
        $this->assertSame(75.0, $service->settings()['delivery_base_fee']);

        SystemSetting::where('key', 'delivery_base_fee')->update(['value' => '80.00']);
        Cache::forget('system_pricing_settings');

        $this->assertSame(80.0, $service->settings()['delivery_base_fee']);
    }

    public function test_onsite_pos_senior_discount_applies_twenty_percent_to_vat_exempt_base(): void
    {
        $totals = app(PricingService::class)->calculatePosDiscount(1120, true);

        $this->assertSame(1000.0, $totals['vatExemptBase']);
        $this->assertSame(200.0, $totals['discountAmount']);
        $this->assertSame(800.0, $totals['total']);
    }

    public function test_onsite_pos_regular_total_is_unchanged(): void
    {
        $totals = app(PricingService::class)->calculatePosDiscount(1120, false);

        $this->assertSame(0.0, $totals['discountAmount']);
        $this->assertSame(1120.0, $totals['total']);
    }

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

    public function test_fixed_price_beverage_total_uses_its_price_times_quantity(): void
    {
        $product = Product::create([
            'name' => 'Fixed price drink',
            'description' => 'Drink',
            'price' => 99,
            'category' => 'fruity-soda-milk',
            'image' => '',
            'is_available' => true,
        ]);

        $pricing = app(PricingService::class)->calculate([[
            'product_id' => $product->id,
            'quantity' => 3,
        ]], 'onsite');

        $this->assertSame(297.0, $pricing['subtotal']);
        $this->assertSame(297.0, $pricing['total']);
    }

    public function test_fixed_price_beverages_reject_size_and_addon_selections(): void
    {
        $product = Product::create([
            'name' => 'Fixed price drink options',
            'description' => 'Drink',
            'price' => 99,
            'category' => 'fruity-soda-milk',
            'image' => '',
            'is_available' => true,
        ]);
        $addonGroup = AddonGroup::create([
            'name' => 'Drink options',
            'selection_type' => 'multiple',
            'supports_quantity' => true,
            'applicable_categories' => ['fruity-soda-milk'],
            'is_active' => true,
        ]);
        $addon = Addon::create([
            'addon_group_id' => $addonGroup->id,
            'name' => 'Soda',
            'price' => 120,
            'is_active' => true,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        app(PricingService::class)->calculate([[
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_addons' => [['id' => $addon->id]],
        ]], 'onsite');
    }

    public function test_fixed_price_beverage_rejects_legacy_size_selection(): void
    {
        $product = Product::create([
            'name' => 'Legacy sized drink',
            'description' => 'Drink',
            'price' => 99,
            'category' => 'fresh-lemonade',
            'image' => '',
            'is_available' => true,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        app(PricingService::class)->calculate([[
            'product_id' => $product->id,
            'quantity' => 1,
            'selected_size' => 'Medium',
        ]], 'onsite');
    }

    public function test_branch_price_override_is_used_for_product_totals(): void
    {
        $branch = Franchise::create([
            'name' => 'Branch price test',
            'status' => 'active',
        ]);
        $product = Product::create([
            'name' => 'Overridden drink',
            'description' => 'Drink',
            'price' => 99,
            'category' => 'fruity-soda-milk',
            'image' => '',
            'is_available' => true,
        ]);
        FranchiseInventory::create([
            'franchise_id' => $branch->id,
            'product_id' => $product->id,
            'is_available' => true,
            'branch_price' => 125,
        ]);

        $pricing = app(PricingService::class)->calculate([[
            'product_id' => $product->id,
            'quantity' => 2,
        ]], 'onsite', 0, 0, null, null, $branch->id);

        $this->assertSame(250.0, $pricing['subtotal']);
        $this->assertSame(250.0, $pricing['total']);
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