<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\FranchiseInventory;
use App\Models\Product;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchRoutingTest extends TestCase
{
    use RefreshDatabase;

    public function test_branch_resolver_rejects_get_with_method_not_allowed(): void
    {
        $this->getJson('/api/branches/resolve')
            ->assertStatus(405)
            ->assertJsonPath('message', 'Method not allowed.');
    }

    public function test_delivery_resolver_chooses_the_nearest_cavite_or_laguna_branch(): void
    {
        $cavite = $this->branch('Cavite branch', 14.3500, 120.9500);
        $laguna = $this->branch('Laguna branch', 14.272967, 121.093142);
        $product = $this->product();
        $this->addInventory($cavite, $product);
        $this->addInventory($laguna, $product);
        $this->strayUnlocatedBranch('main-branch');
        $this->strayUnlocatedBranch('wala-pa-name-laguna');

        $addresses = [
            [['lat' => 14.3194939, 'lng' => 120.9943268], $cavite], // Dasmariñas
            [['lat' => 14.4189, 'lng' => 120.9312], $cavite], // Imus
            [['lat' => 14.4594, 'lng' => 120.9402], $cavite], // Bacoor
            [['lat' => 14.272967, 'lng' => 121.093142], $laguna], // Santa Rosa
            [['lat' => 14.2105, 'lng' => 121.1601], $laguna], // Calamba
        ];

        foreach ($addresses as [$coordinates, $expectedBranch]) {
            $this->postJson('/api/branches/resolve', [
                'address' => 'Test address, Cavite',
                'coordinates' => $coordinates,
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
                'fulfillment_type' => 'delivery',
                'delivery_type' => 'standard',
            ])
                ->assertOk()
                ->assertJsonPath('data.branch.id', $expectedBranch->id)
                ->assertJsonPath('data.franchise_account_id', $expectedBranch->franchise_account_id)
                ->assertJsonPath('data.name', $expectedBranch->name)
                ->assertJsonPath('data.unavailable_items', []);
        }
    }

    public function test_address_is_geocoded_when_checkout_does_not_send_a_pin(): void
    {
        $branch = $this->branch('Cavite branch', 14.3500, 120.9500);
        $product = $this->product();
        $this->mock(GeocodingService::class)
            ->shouldReceive('geocodeAddress')
            ->once()
            ->with('Dasmarinas, Cavite')
            ->andReturn(['lat' => 14.3194939, 'lng' => 120.9943268, 'matchedQuery' => 'Dasmarinas, Cavite']);

        $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertOk()
            ->assertJsonPath('data.branch.id', $branch->id)
            ->assertJsonPath('data.customer_coordinates.lat', 14.3194939);
    }

    public function test_missing_address_and_invalid_delivery_coordinates_return_422(): void
    {
        $this->branch('Cavite branch', 14.3500, 120.9500);
        $product = $this->product();
        $payload = [
            'address' => 'Dasmarinas, Cavite',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ];

        $this->postJson('/api/branches/resolve', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertUnprocessable()->assertJsonValidationErrors(['address']);

        $this->postJson('/api/branches/resolve', $payload + [
            'coordinates' => ['lat' => 91, 'lng' => 120.9],
        ])->assertUnprocessable();

        $this->postJson('/api/branches/resolve', $payload + [
            'coordinates' => ['lat' => 0, 'lng' => 120.9],
        ])->assertUnprocessable()->assertJsonPath('message', 'Please pin a valid delivery location in the Philippines.');
    }

    public function test_geocoding_failure_returns_address_not_found_without_a_server_error(): void
    {
        $product = $this->product();
        $this->mock(GeocodingService::class)
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(null);

        $this->postJson('/api/branches/resolve', [
            'address' => 'Unknown place, Cavite',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertStatus(422)
            ->assertJsonPath('code', 'ADDRESS_NOT_FOUND')
            ->assertJsonPath('message', "We couldn't locate this address. Please edit it or pick a pin on the map.");
    }

    public function test_province_only_geocoding_returns_address_too_broad_and_prompts_for_exact_location(): void
    {
        $product = $this->product();
        $this->mock(GeocodingService::class)
            ->shouldReceive('geocodeAddress')
            ->once()
            ->with('Laguna, Calabarzon, Philippines')
            ->andReturn([
                'lat' => 14.1667,
                'lng' => 121.3333,
                'matchedQuery' => 'Laguna, Calabarzon, Philippines',
                'isBroad' => true,
            ]);

        $this->postJson('/api/branches/resolve', [
            'address' => 'Laguna, Calabarzon, Philippines',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'ADDRESS_TOO_BROAD')
            ->assertJsonPath('message', 'This address only identifies a province or region. Add a city or barangay, or pin your exact location on the map.');
    }

    public function test_null_branch_coordinates_are_reported_in_debug_diagnostics(): void
    {
        config(['app.debug' => true]);
        $cavite = $this->branch('Cavite branch', 14.3500, 120.9500);
        $this->strayUnlocatedBranch('main-branch');
        $product = $this->product();

        $response = $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'coordinates' => ['lat' => 14.3194939, 'lng' => 120.9943268],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertOk()->assertJsonPath('data.branch.id', $cavite->id);

        $diagnostics = collect($response->json('data.branch_diagnostics'));
        $this->assertSame(
            'online orders disabled, delivery disabled, missing or invalid coordinates',
            $diagnostics->firstWhere('name', 'main-branch')['exclusion_reason'],
        );
        $this->assertNotNull($diagnostics->firstWhere('name', 'Cavite branch')['distance_km']);
    }

    public function test_missing_coordinates_return_a_delivery_setup_message(): void
    {
        $this->strayUnlocatedBranch('Laguna branch');
        $product = $this->product();

        $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'coordinates' => ['lat' => 14.3194939, 'lng' => 120.9943268],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertNotFound()
            ->assertJsonPath('code', 'BRANCHES_NOT_CONFIGURED');
    }

    public function test_admin_can_disable_orders_and_delivery_for_a_located_active_branch(): void
    {
        $branch = $this->branch('Cavite branch', 14.3500, 120.9500);
        $branch->accepts_online_orders = false;
        $branch->delivery_enabled = false;
        $branch->save();

        $this->assertFalse($branch->fresh()->accepts_online_orders);
        $this->assertFalse($branch->fresh()->delivery_enabled);
    }

    public function test_inactive_branch_is_not_automatically_enabled_for_delivery(): void
    {
        $branch = $this->branch('Inactive Cavite branch', 14.3500, 120.9500);
        $branch->is_active = false;
        $branch->save();

        $this->assertFalse($branch->fresh()->accepts_online_orders);
        $this->assertFalse($branch->fresh()->delivery_enabled);
    }

    public function test_customer_outside_delivery_radius_gets_specific_message(): void
    {
        $branch = $this->branch('Cavite branch', 14.3500, 120.9500);
        $branch->delivery_radius_km = 1;
        $branch->save();
        $product = $this->product();

        $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'coordinates' => ['lat' => 14.3194939, 'lng' => 120.9943268],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertNotFound()
            ->assertJsonPath('code', 'NO_BRANCH_IN_RANGE')
            ->assertJsonPath('message', 'No active branch is within its delivery radius of this location. Confirm the pin, or ask the administrator to check the branch location and delivery coverage.');
    }

    public function test_null_branch_radius_uses_the_fifteen_kilometer_default(): void
    {
        $this->branch('Cavite branch', 14.3500, 120.9500);
        $product = $this->product();

        $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'coordinates' => ['lat' => 14.5, 'lng' => 120.9333],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertNotFound()
            ->assertJsonPath('code', 'NO_BRANCH_IN_RANGE')
            ->assertJsonPath('message', 'No active branch is within its delivery radius of this location. Confirm the pin, or ask the administrator to check the branch location and delivery coverage.');
    }

    public function test_branch_without_inventory_rows_returns_items_as_unavailable_without_throwing(): void
    {
        $branch = $this->branch('Cavite branch', 14.3500, 120.9500);
        $product = $this->product();

        $this->postJson('/api/branches/resolve', [
            'address' => 'Dasmarinas, Cavite',
            'coordinates' => ['lat' => 14.3194939, 'lng' => 120.9943268],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertOk()
            ->assertJsonPath('data.branch.id', $branch->id)
            ->assertJsonPath('data.unavailable_items', [$product->name]);
    }

    private function branch(string $name, float $latitude, float $longitude): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'address' => $name,
            'status' => 'active',
            'latitude' => (string) $latitude,
            'longitude' => (string) $longitude,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => null,
        ]);
    }

    private function strayUnlocatedBranch(string $name): Franchise
    {
        return Franchise::create([
            'name' => $name,
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
    }

    private function product(): Product
    {
        return Product::create([
            'name' => 'Routing test chicken',
            'description' => 'Routing test product',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);
    }

    private function addInventory(Franchise $branch, Product $product): void
    {
        FranchiseInventory::create([
            'franchise_id' => $branch->id,
            'product_id' => $product->id,
            'stock_quantity' => null,
            'is_available' => true,
        ]);
    }
}
