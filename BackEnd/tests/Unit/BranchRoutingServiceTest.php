<?php

namespace Tests\Unit;

use App\Models\Franchise;
use App\Services\BranchRoutingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchRoutingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_address_uses_the_nearest_cavite_branch(): void
    {
        $cavite = $this->branch('Cavite branch', 14.3290, 120.9360);
        $this->branch('Laguna branch', 14.3181, 121.1011);

        $result = app(BranchRoutingService::class)->resolve([
            'lat' => 14.3295,
            'lng' => 120.9370,
        ]);

        $this->assertSame($cavite->id, $result['branch']->id);
    }

    public function test_dasmarinas_coordinates_select_cavite_with_null_radius_and_stray_unlocated_rows(): void
    {
        $cavite = $this->branch('Cavite branch', 14.3167, 120.9333);
        $this->branch('Laguna branch', 14.272967, 121.093142);
        Franchise::create([
            'name' => 'main-branch',
            'address' => 'Legacy row',
            'status' => 'active',
            'latitude' => null,
            'longitude' => null,
            'franchise_account_id' => null,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => null,
        ]);
        Franchise::create([
            'name' => 'wala-pa-name-laguna',
            'address' => 'Legacy row',
            'status' => 'active',
            'latitude' => null,
            'longitude' => null,
            'franchise_account_id' => null,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => null,
        ]);

        $result = app(BranchRoutingService::class)->resolve([
            'lat' => 14.3194939,
            'lng' => 120.9943268,
        ]);

        $this->assertSame($cavite->id, $result['branch']->id);
        $this->assertGreaterThan(0, $result['distance_km']);
        $diagnostics = collect(app(BranchRoutingService::class)->diagnostics(['lat' => 14.3194939, 'lng' => 120.9943268]));
        $this->assertSame(
            'online orders disabled, delivery disabled, missing or invalid coordinates',
            $diagnostics->firstWhere('name', 'main-branch')['exclusion_reason'],
        );
    }

    public function test_santa_rosa_and_calamba_coordinates_select_laguna_branch(): void
    {
        $this->branch('Cavite branch', 14.3167, 120.9333);
        $laguna = $this->branch('Laguna branch', 14.272967, 121.093142);
        $routing = app(BranchRoutingService::class);

        foreach ([
            ['lat' => 14.272967, 'lng' => 121.093142], // Santa Rosa
            ['lat' => 14.2105, 'lng' => 121.1601], // Calamba
        ] as $coordinates) {
            $this->assertSame($laguna->id, $routing->resolve($coordinates)['branch']->id);
        }
    }

    public function test_branch_specific_delivery_radius_above_default_is_honored(): void
    {
        $laguna = $this->branch('Laguna branch', 14.3181, 121.1011);
        $laguna->delivery_radius_km = 40;
        $laguna->save();
        config(['delivery.default_radius_km' => 15]);

        $result = app(BranchRoutingService::class)->resolve([
            'lat' => 14.1700,
            'lng' => 121.2400,
        ]);

        $this->assertSame($laguna->id, $result['branch']->id);
        $this->assertGreaterThan(15, $result['distance_km']);
        $this->assertLessThanOrEqual(40, $result['distance_km']);
    }

    public function test_null_branch_radius_uses_the_fifteen_kilometer_default(): void
    {
        config(['delivery.default_radius_km' => 15]);
        $this->branch('Laguna branch', 14.3181, 121.1011);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('outside its 15.0 km delivery area');

        app(BranchRoutingService::class)->resolve([
            'lat' => 14.1700,
            'lng' => 121.2400,
        ]);
    }

    public function test_imus_and_bacoor_coordinates_select_cavite_branch(): void
    {
        config(['delivery.default_radius_km' => 20]);
        $cavite = $this->branch('Cavite branch', 14.3167, 120.9333);
        $this->branch('Laguna branch', 14.272967, 121.093142);
        $routing = app(BranchRoutingService::class);

        foreach ([
            ['lat' => 14.4189, 'lng' => 120.9312], // Imus
            ['lat' => 14.4594, 'lng' => 120.9402], // Bacoor
        ] as $coordinates) {
            $this->assertSame($cavite->id, $routing->resolve($coordinates)['branch']->id);
        }
    }

    public function test_delivery_address_uses_the_nearest_laguna_branch(): void
    {
        $this->branch('Cavite branch', 14.3290, 120.9360);
        $laguna = $this->branch('Laguna branch', 14.3181, 121.1011);

        $result = app(BranchRoutingService::class)->resolve([
            'lat' => 14.3185,
            'lng' => 121.1005,
        ]);

        $this->assertSame($laguna->id, $result['branch']->id);
    }

    public function test_changing_coordinates_recomputes_the_selected_branch(): void
    {
        $cavite = $this->branch('Cavite branch', 14.3290, 120.9360);
        $laguna = $this->branch('Laguna branch', 14.3181, 121.1011);
        $routing = app(BranchRoutingService::class);

        $lagunaResult = $routing->resolve(['lat' => 14.3185, 'lng' => 121.1005]);
        $caviteResult = $routing->resolve(['lat' => 14.3295, 'lng' => 120.9370]);

        $this->assertSame($laguna->id, $lagunaResult['branch']->id);
        $this->assertSame($cavite->id, $caviteResult['branch']->id);
    }

    public function test_a_new_active_branch_is_used_without_code_changes(): void
    {
        $this->branch('Existing branch', 14.3181, 121.1011);
        $newBranch = $this->branch('New branch', 14.6000, 120.9800);

        $result = app(BranchRoutingService::class)->resolve([
            'lat' => 14.6005,
            'lng' => 120.9805,
        ]);

        $this->assertSame($newBranch->id, $result['branch']->id);
    }

    public function test_delivery_coordinates_outside_the_philippines_are_rejected(): void
    {
        $this->branch('Cavite branch', 14.3290, 120.9360);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('valid delivery location in the Philippines');

        app(BranchRoutingService::class)->resolve(['lat' => 40.7128, 'lng' => -74.0060]);
    }

    public function test_invalid_or_missing_delivery_coordinates_are_rejected_with_clear_messages(): void
    {
        $routing = app(BranchRoutingService::class);

        try {
            $routing->resolve(null);
            $this->fail('Expected missing delivery coordinates to be rejected.');
        } catch (\InvalidArgumentException $exception) {
            $this->assertStringContainsString('pin your delivery location', $exception->getMessage());
        }

        try {
            $routing->resolve(['lat' => 'not-a-number', 'lng' => 120.9]);
            $this->fail('Expected invalid delivery coordinates to be rejected.');
        } catch (\InvalidArgumentException $exception) {
            $this->assertStringContainsString('valid delivery location', $exception->getMessage());
        }
    }

    private function branch(string $name, float $latitude, float $longitude): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'address' => $name,
            'status' => 'active',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => null,
        ]);
    }
}
