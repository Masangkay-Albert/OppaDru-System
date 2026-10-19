<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\FranchiseInventory;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchRoutingTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_resolver_chooses_the_nearest_cavite_or_laguna_branch(): void
    {
        $cavite = $this->branch('Cavite branch', 14.3167, 120.9333);
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
                'coordinates' => $coordinates,
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
                'fulfillment_type' => 'delivery',
                'delivery_type' => 'standard',
            ])
                ->assertOk()
                ->assertJsonPath('data.branch.id', $expectedBranch->id)
                ->assertJsonPath('data.unavailable_items', []);
        }
    }

    public function test_missing_and_invalid_delivery_coordinates_return_422(): void
    {
        $this->branch('Cavite branch', 14.3167, 120.9333);
        $product = $this->product();
        $payload = [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ];

        $this->postJson('/api/branches/resolve', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['coordinates.lat', 'coordinates.lng']);

        $this->postJson('/api/branches/resolve', $payload + [
            'coordinates' => ['lat' => 91, 'lng' => 120.9],
        ])->assertUnprocessable();

        $this->postJson('/api/branches/resolve', $payload + [
            'coordinates' => ['lat' => 0, 'lng' => 120.9],
        ])->assertUnprocessable()->assertJsonPath('message', 'Please pin a valid delivery location in the Philippines.');
    }

    public function test_null_branch_coordinates_are_reported_in_debug_diagnostics(): void
    {
        config(['app.debug' => true]);
        $cavite = $this->branch('Cavite branch', 14.3167, 120.9333);
        $this->strayUnlocatedBranch('main-branch');
        $product = $this->product();

        $response = $this->postJson('/api/branches/resolve', [
            'coordinates' => ['lat' => 14.3194939, 'lng' => 120.9943268],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery',
        ])->assertOk()->assertJsonPath('data.branch.id', $cavite->id);

        $diagnostics = collect($response->json('data.branch_diagnostics'));
        $this->assertSame('missing or invalid coordinates', $diagnostics->firstWhere('name', 'main-branch')['exclusion_reason']);
        $this->assertNotNull($diagnostics->firstWhere('name', 'Cavite branch')['distance_km']);
    }

    public function test_branch_without_inventory_rows_returns_items_as_unavailable_without_throwing(): void
    {
        $branch = $this->branch('Cavite branch', 14.3167, 120.9333);
        $product = $this->product();

        $this->postJson('/api/branches/resolve', [
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
