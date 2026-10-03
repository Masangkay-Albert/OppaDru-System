<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FranchiseAccessTest extends TestCase
{
    use RefreshDatabase;

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
        $statusResponse->assertOk();
        $this->assertSame('ready', $statusResponse->json('data.status'));

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
        $this->assertSame(150.0, round((float) $summaryResponse->json('data.total_revenue'), 1));

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
        $this->assertSame(150.0, round((float) $summaryAdminResponse->json('data.total_revenue'), 1));

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
}
