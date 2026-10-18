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
