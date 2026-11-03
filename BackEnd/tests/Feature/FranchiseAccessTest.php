<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseUser;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Services\FranchiseInventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class FranchiseAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_newly_added_products_are_initialized_for_existing_branch_catalogs(): void
    {
        $branch = Franchise::create([
            'name' => 'Cavite Main Branch',
            'status' => 'active',
        ]);
        $initialProduct = Product::create([
            'name' => 'Initial Menu Item',
            'description' => 'Existing menu item',
            'price' => 100,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);

        $inventoryService = app(FranchiseInventoryService::class);
        $inventoryService->initializeBranchMenu((string) $branch->id);

        $newProduct = Product::create([
            'name' => 'New Shared Menu Item',
            'description' => 'Added after branch setup',
            'price' => 150,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);

        $catalog = $inventoryService->catalog((string) $branch->id)->keyBy('id');

        $this->assertTrue($catalog->get($newProduct->id)['branch_available']);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $branch->id,
            'product_id' => $newProduct->id,
            'is_available' => true,
        ]);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $branch->id,
            'product_id' => $initialProduct->id,
            'is_available' => true,
        ]);
    }

    public function test_franchise_user_can_login_and_view_shared_and_branch_products(): void
    {
        $franchiseA = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
        ]);

        $franchiseB = Franchise::create([
            'name' => 'South Branch',
            'email' => 'south@example.com',
            'phone' => '09170000002',
            'address' => '456 South St',
            'status' => 'active',
        ]);

        FranchiseUser::create([
            'franchise_id' => $franchiseA->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'phone' => '09170000011',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);

        Product::create([
            'name' => 'Shared Menu Item',
            'description' => 'Main branch menu item visible to all franchisees',
            'price' => 120.00,
            'category' => 'rice',
            'image' => '',
            'is_available' => true,
        ]);

        Product::create([
            'name' => 'North House Special',
            'description' => 'Branch-owned product',
            'price' => 150.00,
            'category' => 'rice',
            'image' => '',
            'franchise_id' => $franchiseA->id,
            'is_available' => true,
        ]);

        Product::create([
            'name' => 'South Secret Menu',
            'description' => 'Competitor product',
            'price' => 170.00,
            'category' => 'rice',
            'image' => '',
            'franchise_id' => $franchiseB->id,
            'is_available' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ]);

        $login->assertOk();
        $token = $login->json('token');

        $response = $this->getJson('/api/franchise/products', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('Shared Menu Item', $names);
        $this->assertContains('North House Special', $names);
        $this->assertNotContains('South Secret Menu', $names);
    }

    public function test_franchise_product_creation_is_scoped_to_authenticated_branch(): void
    {
        $franchiseA = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
        ]);
        $franchiseB = Franchise::create([
            'name' => 'South Branch',
            'email' => 'south@example.com',
            'phone' => '09170000002',
            'address' => '456 South St',
            'status' => 'active',
        ]);
        FranchiseUser::create([
            'franchise_id' => $franchiseA->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'phone' => '09170000011',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'role' => 'manager',
        ]);
        FranchiseUser::create([
            'franchise_id' => $franchiseB->id,
            'full_name' => 'South Manager',
            'email' => 'south.manager@example.com',
            'phone' => '09170000012',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'role' => 'manager',
        ]);

        $northLogin = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $northHeaders = ['Authorization' => 'Bearer '.$northLogin->json('token')];

        $request = [
            'franchise_id' => $franchiseB->id,
            'name' => 'North Branch Special',
            'description' => 'Available only at the north branch.',
            'price' => 125,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ];
        $this->postJson('/api/franchise/products', $request, $northHeaders)->assertForbidden();

        unset($request['franchise_id']);
        $created = $this->postJson('/api/franchise/products', $request, $northHeaders)->assertCreated();

        $productId = $created->json('product.id');
        $created->assertJsonPath('product.franchise_id', $franchiseA->id);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $franchiseA->id,
            'product_id' => $productId,
            'is_available' => true,
        ]);

        $this->getJson('/api/franchise/inventory', $northHeaders)
            ->assertOk()
            ->assertJsonFragment(['id' => $productId]);
        $caviteCatalog = $this->getJson('/api/products/available?franchise_id='.$franchiseA->id)
            ->assertOk()
            ->assertJsonFragment(['id' => $productId]);
        $this->assertStringContainsString('no-store', (string) $caviteCatalog->headers->get('Cache-Control'));

        $southLogin = $this->postJson('/api/franchise/login', [
            'email' => 'south.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $this->getJson('/api/franchise/inventory', [
            'Authorization' => 'Bearer '.$southLogin->json('token'),
        ])->assertOk()->assertJsonMissing(['id' => $productId]);
        $this->getJson('/api/products/available?franchise_id='.$franchiseB->id)
            ->assertOk()
            ->assertJsonMissing(['id' => $productId]);

        $imageResponse = $this->post('/api/franchise/products/upload-image', [
            'image' => UploadedFile::fake()->create('branch-product.jpg', 1, 'image/jpeg'),
        ], $northHeaders)->assertOk();
        $imageUrl = $imageResponse->json('url');
        $this->assertIsString($imageUrl);
        $this->assertStringStartsWith('data:image/', $imageUrl);
    }

    public function test_franchise_archived_products_and_mutations_are_scoped_to_authenticated_branch(): void
    {
        $north = Franchise::create(['name' => 'North Branch', 'status' => 'active']);
        $south = Franchise::create(['name' => 'South Branch', 'status' => 'active']);
        FranchiseUser::create([
            'franchise_id' => $north->id,
            'full_name' => 'North Manager',
            'email' => 'north.archive@example.com',
            'phone' => '09170000013',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'role' => 'manager',
        ]);
        FranchiseUser::create([
            'franchise_id' => $south->id,
            'full_name' => 'South Manager',
            'email' => 'south.archive@example.com',
            'phone' => '09170000014',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'role' => 'manager',
        ]);
        FranchiseUser::create([
            'franchise_id' => $north->id,
            'full_name' => 'North Staff',
            'email' => 'north.staff@example.com',
            'phone' => '09170000015',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'role' => 'staff',
        ]);
        $northProduct = Product::create([
            'name' => 'North Archived Product',
            'description' => 'North branch only',
            'price' => 100,
            'category' => 'chicken',
            'franchise_id' => $north->id,
            'image' => '',
            'is_available' => true,
        ]);
        $southProduct = Product::create([
            'name' => 'South Archived Product',
            'description' => 'South branch only',
            'price' => 110,
            'category' => 'chicken',
            'franchise_id' => $south->id,
            'image' => '',
            'is_available' => true,
        ]);
        $southActiveProduct = Product::create([
            'name' => 'South Active Product',
            'description' => 'South branch only',
            'price' => 115,
            'category' => 'chicken',
            'franchise_id' => $south->id,
            'image' => '',
            'is_available' => true,
        ]);

        $northLogin = $this->postJson('/api/franchise/login', [
            'email' => 'north.archive@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $northHeaders = ['Authorization' => 'Bearer '.$northLogin->json('token')];
        $southProduct->delete();

        $this->getJson('/api/franchise/products/archived', $northHeaders)
            ->assertOk()
            ->assertJsonMissing(['id' => $southProduct->id])
            ->assertJsonMissing(['id' => $northProduct->id]);
        $this->putJson('/api/franchise/products/'.$northProduct->id, ['price' => 125], $northHeaders)
            ->assertOk();
        $this->assertDatabaseHas('products', ['id' => $northProduct->id, 'price' => 125]);
        $this->patchJson('/api/franchise/products/'.$northProduct->id.'/archive', [], $northHeaders)->assertOk();
        $this->getJson('/api/franchise/products/archived', $northHeaders)
            ->assertOk()
            ->assertJsonFragment(['id' => $northProduct->id])
            ->assertJsonMissing(['id' => $southProduct->id]);

        $this->putJson('/api/franchise/products/'.$southActiveProduct->id, ['price' => 1], $northHeaders)->assertNotFound();
        $this->patchJson('/api/franchise/products/'.$southActiveProduct->id.'/archive', [], $northHeaders)->assertNotFound();
        $this->patchJson('/api/franchise/products/'.$southProduct->id.'/restore', [], $northHeaders)->assertNotFound();
        $this->deleteJson('/api/franchise/products/'.$southActiveProduct->id, [], $northHeaders)->assertNotFound();
        $this->patchJson('/api/franchise/inventory/'.$southActiveProduct->id, ['is_available' => false], $northHeaders)
            ->assertNotFound();
        $this->assertDatabaseHas('products', ['id' => $southActiveProduct->id, 'is_available' => true]);
        $staffLogin = $this->postJson('/api/franchise/login', [
            'email' => 'north.staff@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $this->patchJson('/api/franchise/inventory/'.$northProduct->id, ['is_available' => false], [
            'Authorization' => 'Bearer '.$staffLogin->json('token'),
        ])->assertForbidden();
    }

    public function test_franchise_user_cannot_access_another_franchise_scope(): void
    {
        $franchiseA = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
        ]);

        $franchiseB = Franchise::create([
            'name' => 'South Branch',
            'email' => 'south@example.com',
            'phone' => '09170000002',
            'address' => '456 South St',
            'status' => 'active',
        ]);

        FranchiseUser::create([
            'franchise_id' => $franchiseA->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'phone' => '09170000011',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ]);

        $token = $login->json('token');

        $response = $this->getJson('/api/franchise/orders?franchise_id=' . $franchiseB->id, [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertStatus(403);
        $this->assertSame('You do not have access to this franchise', $response->json('message'));
    }

    public function test_franchise_user_can_view_and_update_only_their_branch_orders(): void
    {
        $franchiseA = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
        ]);

        $franchiseB = Franchise::create([
            'name' => 'South Branch',
            'email' => 'south@example.com',
            'phone' => '09170000002',
            'address' => '456 South St',
            'status' => 'active',
        ]);

        FranchiseUser::create([
            'franchise_id' => $franchiseA->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'phone' => '09170000011',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);

        $ownOrder = Order::create([
            'branch_id' => $franchiseA->id,
            'franchise_id' => $franchiseA->id,
            'email' => 'customer-a@example.com',
            'phone' => '09170000021',
            'items' => [['product_id' => 'franchise-product-1', 'product_name' => 'North House Special', 'product_price' => 150, 'quantity' => 1]],
            'total' => 150.00,
            'delivery_address' => 'North Avenue',
            'payment_method' => 'cash_on_delivery',
            'status' => 'pending',
        ]);

        $otherOrder = Order::create([
            'branch_id' => $franchiseB->id,
            'franchise_id' => $franchiseB->id,
            'email' => 'customer-b@example.com',
            'phone' => '09170000022',
            'items' => [['product_id' => 'franchise-product-2', 'product_name' => 'South Secret Menu', 'product_price' => 170, 'quantity' => 1]],
            'total' => 170.00,
            'delivery_address' => 'South Avenue',
            'payment_method' => 'cash_on_delivery',
            'status' => 'pending',
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ]);

        $token = $login->json('token');

        $ordersResponse = $this->getJson('/api/franchise/orders', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $ordersResponse->assertOk();
        $this->assertCount(1, $ordersResponse->json('data'));
        $this->assertSame($ownOrder->id, $ordersResponse->json('data.0.id'));

        $showResponse = $this->getJson('/api/franchise/orders/' . $ownOrder->id, [
            'Authorization' => 'Bearer ' . $token,
        ]);
        $showResponse->assertOk();
        $this->assertSame('pending', $showResponse->json('data.status'));

        $statusResponse = $this->patchJson('/api/franchise/orders/' . $ownOrder->id . '/status', [
            'status' => 'ready',
        ], [
            'Authorization' => 'Bearer ' . $token,
        ]);
        $statusResponse->assertNotFound();
        $this->assertSame('pending', $ownOrder->fresh()->status);

        $blockedResponse = $this->getJson('/api/franchise/orders/' . $otherOrder->id, [
            'Authorization' => 'Bearer ' . $token,
        ]);
        $blockedResponse->assertNotFound();
    }

    public function test_franchise_dashboard_and_admin_stats_return_expected_metrics(): void
    {
        $franchiseA = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
        ]);

        FranchiseUser::create([
            'franchise_id' => $franchiseA->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'phone' => '09170000011',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);

        Product::create([
            'name' => 'Shared Menu Item',
            'description' => 'Main branch menu item visible to all franchisees',
            'price' => 120.00,
            'category' => 'rice',
            'image' => '',
            'is_available' => true,
        ]);

        Product::create([
            'name' => 'North House Special',
            'description' => 'Branch-owned product',
            'price' => 150.00,
            'category' => 'rice',
            'image' => '',
            'franchise_id' => $franchiseA->id,
            'is_available' => true,
        ]);

        Order::create([
            'franchise_id' => $franchiseA->id,
            'email' => 'customer-a@example.com',
            'phone' => '09170000021',
            'items' => [['product_id' => 'franchise-product-1', 'product_name' => 'North House Special', 'product_price' => 150, 'quantity' => 1]],
            'total' => 150.00,
            'delivery_address' => 'North Avenue',
            'payment_method' => 'cash_on_delivery',
            'status' => 'pending',
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ]);

        $token = $login->json('token');

        $dashboardResponse = $this->getJson('/api/franchise/dashboard', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $dashboardResponse->assertOk();
        $this->assertSame($franchiseA->id, $dashboardResponse->json('data.franchise_id'));
        $this->assertSame(2, $dashboardResponse->json('data.products'));
        $this->assertSame(1, $dashboardResponse->json('data.orders'));

        $summaryResponse = $this->getJson('/api/franchise/summary', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $summaryResponse->assertOk();
        $this->assertSame(0.0, round((float) $summaryResponse->json('data.total_revenue'), 1));

        $inventoryResponse = $this->getJson('/api/franchise/inventory', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $inventoryResponse->assertOk();
        $this->assertSame(2, $inventoryResponse->json('data.total_products'));
        $this->assertSame(2, $inventoryResponse->json('data.available_products'));

        $fulfillmentResponse = $this->getJson('/api/franchise/fulfillment', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $fulfillmentResponse->assertOk();
        $this->assertSame(1, $fulfillmentResponse->json('data.total_orders'));
        $this->assertSame(1, $fulfillmentResponse->json('data.pending_orders'));

        $adminLogin = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $adminToken = $adminLogin->json('token');

        $statsResponse = $this->getJson('/api/admin/franchises/stats', [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $statsResponse->assertOk();
        $this->assertSame(1, $statsResponse->json('data.total_franchises'));
        $this->assertSame(1, $statsResponse->json('data.active_franchises'));

        $usersResponse = $this->getJson('/api/admin/franchises/' . $franchiseA->id . '/users', [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $usersResponse->assertOk();
        $this->assertCount(1, $usersResponse->json('data'));

        $createdUserResponse = $this->postJson('/api/admin/franchises/' . $franchiseA->id . '/users', [
            'full_name' => 'Second Manager',
            'email' => 'second.manager@example.com',
            'phone' => '09170000012',
            'password' => 'Franchise@123',
            'is_active' => true,
        ], [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $createdUserResponse->assertCreated();
        $this->assertSame('Second Manager', $createdUserResponse->json('data.full_name'));

        $updatedUserResponse = $this->putJson('/api/admin/franchises/' . $franchiseA->id . '/users/' . $createdUserResponse->json('data.id'), [
            'full_name' => 'Second Manager Updated',
            'is_active' => false,
        ], [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $updatedUserResponse->assertOk();
        $this->assertSame('Second Manager Updated', $updatedUserResponse->json('data.full_name'));
        $this->assertFalse($updatedUserResponse->json('data.is_active'));

        $toggleResponse = $this->patchJson('/api/admin/franchises/' . $franchiseA->id . '/users/' . $createdUserResponse->json('data.id') . '/toggle-status', [
            'is_active' => true,
        ], [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $toggleResponse->assertOk();
        $this->assertTrue($toggleResponse->json('data.is_active'));

        $summaryAdminResponse = $this->getJson('/api/admin/franchises/' . $franchiseA->id . '/summary', [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);

        $summaryAdminResponse->assertOk();
        $this->assertSame(2, $summaryAdminResponse->json('data.total_users'));
        $this->assertSame(0.0, round((float) $summaryAdminResponse->json('data.total_revenue'), 1));

        $branchInventoryResponse = $this->getJson('/api/admin/franchises/' . $franchiseA->id . '/inventory', [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);
        $branchInventoryResponse->assertOk();
        $this->assertSame(1, $branchInventoryResponse->json('data.total_products'));

        $branchFulfillmentResponse = $this->getJson('/api/admin/franchises/' . $franchiseA->id . '/fulfillment', [
            'Authorization' => 'Bearer ' . $adminToken,
        ]);
        $branchFulfillmentResponse->assertOk();
        $this->assertSame(1, $branchFulfillmentResponse->json('data.total_orders'));
    }

    public function test_public_branch_catalog_contains_only_shared_and_selected_branch_products(): void
    {
        $branch = Franchise::create([
            'name' => 'East Branch',
            'email' => 'east@example.com',
            'phone' => '09170000003',
            'address' => '789 East St',
            'status' => 'active',
        ]);
        $inactiveBranch = Franchise::create([
            'name' => 'Closed Branch',
            'email' => 'closed@example.com',
            'phone' => '09170000004',
            'address' => 'Closed St',
            'status' => 'inactive',
        ]);
        $westBranch = Franchise::create([
            'name' => 'West Branch',
            'email' => 'west@example.com',
            'phone' => '09170000005',
            'address' => '321 West St',
            'status' => 'active',
        ]);
        $inactiveAccount = FranchiseAccount::create([
            'name' => 'Inactive Corporation',
            'status' => 'inactive',
        ]);
        Franchise::create([
            'name' => 'Inactive Account Branch',
            'address' => 'Inactive corporation location',
            'franchise_account_id' => $inactiveAccount->id,
            'status' => 'active',
            'is_active' => true,
        ]);

        Product::create([
            'name' => 'Shared Bowl',
            'description' => 'Available everywhere',
            'price' => 100,
            'category' => 'rice-meals',
            'image' => '',
            'is_available' => true,
        ]);
        Product::create([
            'name' => 'East Special',
            'description' => 'East branch product',
            'price' => 120,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        Product::create([
            'name' => 'Closed Branch Item',
            'description' => 'Not sold at East',
            'price' => 130,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $inactiveBranch->id,
            'is_available' => true,
        ]);
        Product::create([
            'name' => 'West Branch Apple',
            'description' => 'Available only at West',
            'price' => 140,
            'category' => 'fruity-soda',
            'image' => '',
            'franchise_id' => $westBranch->id,
            'is_available' => true,
        ]);

        $branches = $this->getJson('/api/franchises/active');
        $branches->assertOk();
        $this->assertCount(2, $branches->json('data'));
        $this->assertNotContains('Inactive Account Branch', collect($branches->json('data'))->pluck('name')->all());

        $catalog = $this->getJson('/api/products/available?franchise_id=' . $branch->id);
        $catalog->assertOk();
        $this->assertSame(
            ['East Special', 'Shared Bowl'],
            collect($catalog->json())->pluck('name')->sort()->values()->all()
        );

        $westCatalog = $this->getJson('/api/products/available?franchise_id=' . $westBranch->id);
        $westCatalog->assertOk();
        $this->assertSame(
            ['Shared Bowl', 'West Branch Apple'],
            collect($westCatalog->json())->pluck('name')->sort()->values()->all()
        );
    }

    public function test_franchise_pos_creates_branch_scoped_order_using_server_prices(): void
    {
        $branch = Franchise::create([
            'name' => 'West Branch',
            'email' => 'west@example.com',
            'phone' => '09170000005',
            'address' => '101 West St',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'West Manager',
            'email' => 'west.manager@example.com',
            'phone' => '09170000015',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
        $product = Product::create([
            'name' => 'West Rice Meal',
            'description' => 'Branch POS item',
            'price' => 80,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'west.manager@example.com',
            'password' => 'Franchise@123',
        ]);
        $login->assertOk();
        $token = $login->json('token');

        $response = $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'customer_name' => 'Walk-in Guest',
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
        ], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertCreated();
        $this->assertSame($branch->id, $response->json('order.franchise_id'));
        $this->assertSame(160.0, (float) $response->json('order.total'));
        $this->assertSame(40.0, (float) $response->json('change_due'));
        $this->assertSame('onsite', $response->json('order.delivery_type'));
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'franchise_id' => $branch->id,
            'franchise_user_id' => $manager->id,
        ]);

        $discountedResponse = $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 100,
            'discount_type' => 'Senior Citizen',
            'discount_id_number' => 'SC-12345',
            'discount_cardholder_name' => 'Senior Guest',
        ], [
            'Authorization' => 'Bearer ' . $token,
        ])->assertCreated();

        $this->assertSame(57.0, (float) $discountedResponse->json('order.total'));
        $this->assertSame(14.0, (float) $discountedResponse->json('order.discount_amount'));
        $this->assertSame(0.0, (float) $discountedResponse->json('order.vat'));
        $this->assertSame(43.0, (float) $discountedResponse->json('change_due'));
    }

    public function test_branch_inventory_stock_is_initializable_consumed_and_isolated(): void
    {
        $branch = Franchise::create([
            'name' => 'Inventory Branch',
            'email' => 'inventory@example.com',
            'phone' => '09170000021',
            'address' => 'Inventory St',
            'status' => 'active',
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Inventory Branch',
            'email' => 'other-inventory@example.com',
            'phone' => '09170000022',
            'address' => 'Other St',
            'status' => 'active',
        ]);
        FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'Inventory Manager',
            'email' => 'inventory.manager@example.com',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
        $sharedProduct = Product::create([
            'name' => 'Shared Inventory Product',
            'description' => 'Shared product with branch stock',
            'price' => 80,
            'category' => 'rice-meals',
            'image' => '',
            'is_available' => true,
        ]);
        $otherProduct = Product::create([
            'name' => 'Other Branch Product',
            'description' => 'Must stay isolated',
            'price' => 100,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $otherBranch->id,
            'is_available' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'inventory.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $catalog = $this->getJson('/api/franchise/inventory', $headers)->assertOk();
        $this->assertSame([$sharedProduct->id], collect($catalog->json('data.items'))->pluck('id')->all());

        $this->patchJson('/api/franchise/inventory/' . $sharedProduct->id, [
            'stock_quantity' => 3,
        ], $headers)->assertOk();
        $this->patchJson('/api/franchise/inventory/' . $otherProduct->id, [
            'stock_quantity' => 5,
        ], $headers)->assertNotFound();

        $this->getJson('/api/franchise/users', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.email', 'inventory.manager@example.com');
        $this->getJson('/api/franchise/settings', $headers)
            ->assertOk()
            ->assertJsonPath('data.name', 'Inventory Branch');

        $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $sharedProduct->id, 'quantity' => 2]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
        ], $headers)->assertCreated();

        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $branch->id,
            'product_id' => $sharedProduct->id,
            'stock_quantity' => 1,
        ]);

        $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $sharedProduct->id, 'quantity' => 2]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
        ], $headers)->assertUnprocessable();

        $dashboard = $this->getJson('/api/franchise/dashboard', $headers)->assertOk();
        $this->assertSame($branch->id, $dashboard->json('data.franchise_id'));
        $this->assertSame(1, $dashboard->json('data.total_orders'));
        $this->assertSame(1, $dashboard->json('data.branch_users'));

        $this->getJson('/api/franchise/reports', $headers)
            ->assertOk()
            ->assertJsonPath('data.total_orders', 1);
    }

    public function test_franchise_pos_validates_branch_addons_and_prices_drink_sizes_server_side(): void
    {
        $branch = Franchise::create([
            'name' => 'Options Branch',
            'email' => 'options@example.com',
            'phone' => '09170000031',
            'address' => 'Options St',
            'status' => 'active',
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Options Branch',
            'email' => 'other-options@example.com',
            'phone' => '09170000032',
            'address' => 'Other Options St',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'Options Manager',
            'email' => 'options.manager@example.com',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
        $drink = Product::create([
            'name' => 'Branch Lemonade',
            'description' => 'Customizable branch drink',
            'price' => 100,
            'category' => 'fresh-lemonade',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $branchGroup = AddonGroup::create([
            'franchise_id' => $branch->id,
            'name' => 'Branch toppings',
            'selection_type' => 'multiple',
            'supports_quantity' => false,
            'max_selections' => 2,
            'applicable_categories' => ['fresh-lemonade'],
            'is_active' => true,
        ]);
        $branchAddon = Addon::create([
            'addon_group_id' => $branchGroup->id,
            'name' => 'Jelly',
            'price' => 15,
            'is_active' => true,
        ]);
        $otherGroup = AddonGroup::create([
            'franchise_id' => $otherBranch->id,
            'name' => 'Other branch topping',
            'selection_type' => 'multiple',
            'supports_quantity' => false,
            'applicable_categories' => ['fresh-lemonade'],
            'is_active' => true,
        ]);
        $otherAddon = Addon::create([
            'addon_group_id' => $otherGroup->id,
            'name' => 'Other topping',
            'price' => 99,
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'options.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $this->getJson('/api/franchise/addon-groups?category=fresh-lemonade&product_id=' . $drink->id, $headers)
            ->assertOk()
            ->assertJsonFragment(['name' => 'Branch toppings'])
            ->assertJsonMissing(['name' => 'Other branch topping']);

        $response = $this->postJson('/api/franchise/pos/orders', [
            'items' => [[
                'product_id' => $drink->id,
                'quantity' => 1,
                'selected_size' => 'Large',
                'selected_addons' => [['id' => $branchAddon->id, 'quantity' => 1]],
            ]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
        ], $headers)->assertCreated();

        $this->assertSame(135.0, (float) $response->json('order.total'));
        $this->assertSame('Large', $response->json('order.items.0.selected_size'));
        $this->assertSame(120.0, (float) $response->json('order.items.0.product_price'));
        $this->assertSame(15.0, (float) $response->json('order.items.0.selected_addons.0.price'));

        $paymentPayload = [
            'items' => [[
                'product_id' => $drink->id,
                'quantity' => 1,
                'selected_size' => 'Large',
                'selected_addons' => [['id' => $branchAddon->id, 'quantity' => 1]],
            ]],
            'dining_option' => 'takeout',
            'payment_method' => 'gcash',
            'payment_reference' => 'UNVERIFIED-REFERENCE',
        ];
        $this->postJson('/api/franchise/pos/orders', $paymentPayload, $headers)->assertUnprocessable();
        $payment = Payment::create([
            'reference' => 'GATEWAY-POS-REFERENCE',
            'provider' => 'paymongo',
            'amount' => 135,
            'status' => 'paid',
            'paid_at' => now(),
            'metadata' => [
                'purpose' => 'franchise_pos',
                'franchise_id' => $branch->id,
                'cashier_employee_id' => null,
                'franchise_user_id' => $manager->id,
            ],
        ]);
        $paymentPayload['payment_reference'] = $payment->reference;
        $this->postJson('/api/franchise/pos/orders', $paymentPayload, $headers)->assertCreated();
        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'order_id' => Order::where('payment_reference', $payment->reference)->value('id'),
        ]);
        $this->postJson('/api/franchise/pos/orders', $paymentPayload, $headers)->assertUnprocessable();

        $this->postJson('/api/franchise/pos/orders', [
            'items' => [[
                'product_id' => $drink->id,
                'quantity' => 1,
                'selected_size' => 'Medium',
                'selected_addons' => [['id' => $otherAddon->id, 'quantity' => 1]],
            ]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
        ], $headers)->assertUnprocessable();
    }

    public function test_franchise_pos_creates_gateway_payment_for_server_calculated_total(): void
    {
        $branch = Franchise::create([
            'name' => 'Payment Branch',
            'email' => 'payment-branch@example.com',
            'phone' => '09170000041',
            'address' => 'Payment St',
            'status' => 'active',
        ]);
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'Payment Manager',
            'email' => 'payment.manager@example.com',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
        $product = Product::create([
            'name' => 'Payment Branch Drink',
            'description' => 'Drink whose size is priced by the server',
            'price' => 100,
            'category' => 'fresh-lemonade',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => 'payment.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        config([
            'services.paymongo.secret_key' => 'sk_test_branch',
            'services.paymongo.base_url' => 'https://paymongo.test',
            'app.frontend_url' => 'https://frontend.test',
        ]);
        Http::fake([
            'https://paymongo.test/sources' => Http::response([
                'data' => [
                    'id' => 'src_branch_pos',
                    'attributes' => [
                        'status' => 'pending',
                        'redirect' => ['checkout_url' => 'https://paymongo.test/checkout'],
                    ],
                ],
            ]),
        ]);

        $response = $this->postJson('/api/franchise/pos/payments/gcash', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'selected_size' => 'Large',
                'selected_addons' => [],
            ]],
            'payment_method' => 'gcash',
        ], $headers)->assertCreated();

        $reference = $response->json('data.reference');
        $this->assertSame(120.0, (float) $response->json('data.amount'));
        $this->assertSame('https://paymongo.test/checkout', $response->json('data.checkout_url'));
        $this->assertDatabaseHas('payments', [
            'reference' => $reference,
            'amount' => 120,
            'status' => 'pending',
        ]);
        $this->assertSame('franchise_pos', data_get(Payment::where('reference', $reference)->first()->metadata, 'purpose'));
        $this->assertSame($branch->id, data_get(Payment::where('reference', $reference)->first()->metadata, 'franchise_id'));
        $this->assertSame($manager->id, data_get(Payment::where('reference', $reference)->first()->metadata, 'franchise_user_id'));
    }

    public function test_franchise_manager_can_edit_only_branch_phone_and_operating_hours(): void
    {
        $branch = Franchise::create([
            'name' => 'North Branch',
            'email' => 'north@example.com',
            'phone' => '09170000001',
            'address' => '123 North St',
            'status' => 'active',
            'metadata' => ['region' => 'north'],
        ]);
        $otherBranch = Franchise::create([
            'name' => 'South Branch',
            'phone' => '09170000002',
            'address' => '456 South St',
            'status' => 'active',
        ]);
        FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();

        $this->putJson('/api/franchise/settings', [
            'phone' => '09179998888',
            'operating_hours' => 'Daily, 10:00 AM - 9:00 PM',
            'address' => 'Unauthorized address change',
            'status' => 'inactive',
        ], ['Authorization' => 'Bearer ' . $login->json('token')])->assertOk()
            ->assertJsonPath('data.phone', '09179998888')
            ->assertJsonPath('data.operating_hours', 'Daily, 10:00 AM - 9:00 PM')
            ->assertJsonPath('data.address', '123 North St')
            ->assertJsonPath('data.status', 'active');

        $this->assertSame(['region' => 'north', 'operating_hours' => 'Daily, 10:00 AM - 9:00 PM'], $branch->fresh()->metadata);
        $this->assertSame('09170000002', $otherBranch->fresh()->phone);
    }

    public function test_franchise_manager_cannot_create_another_manager_account(): void
    {
        $branch = Franchise::create(['name' => 'North Branch', 'status' => 'active']);
        $otherBranch = Franchise::create(['name' => 'South Branch', 'status' => 'active']);
        FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'North Manager',
            'email' => 'north.manager@example.com',
            'password' => Hash::make('Franchise@123'),
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => 'north.manager@example.com',
            'password' => 'Franchise@123',
        ])->assertOk();

        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];
        $managerData = [
            'name' => 'Assistant Manager',
            'email' => 'assistant.manager@example.com',
            'password' => 'Assistant@123',
            'role' => 'manager',
        ];
        $this->postJson('/api/franchise/users', [
            ...$managerData,
            'franchise_id' => $otherBranch->id,
        ], $headers)->assertForbidden();

        $this->postJson('/api/franchise/users', $managerData, $headers)->assertUnprocessable();
        $this->assertDatabaseMissing('franchise_users', ['email' => 'assistant.manager@example.com']);
    }
}
