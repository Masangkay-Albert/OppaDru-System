<?php

namespace Tests\Feature;

use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Employee;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FranchisePosIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_pos_orders_are_attributed_and_activity_is_location_scoped(): void
    {
        $branch = $this->makeBranch('Pos Activity Branch');
        $otherBranch = $this->makeBranch('Other Pos Activity Branch');
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'Activity Manager',
            'email' => 'activity.manager@test',
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
        $product = Product::create([
            'name' => 'POS Activity Meal',
            'description' => 'Branch register item',
            'price' => 80,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $sale = $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'dining_option' => 'takeout',
            'payment_method' => 'cash',
            'cash_tendered' => 100,
        ], $headers)->assertCreated();
        $saleId = $sale->json('order.id');
        $this->assertDatabaseHas('orders', [
            'id' => $saleId,
            'franchise_id' => $branch->id,
            'cashier_employee_id' => null,
            'franchise_user_id' => $manager->id,
            'payment_status' => 'paid',
        ]);

        Order::create([
            'franchise_id' => $otherBranch->id,
            'email' => 'other.manager@test',
            'total' => 450,
            'delivery_type' => 'onsite',
            'delivery_address' => 'Onsite - Takeout',
            'phone' => '',
            'items' => [],
            'status' => 'pending',
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $this->getJson('/api/franchise/pos/orders', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $saleId)
            ->assertJsonPath('data.0.franchise_id', $branch->id)
            ->assertJsonPath('data.0.location_name', $branch->name)
            ->assertJsonPath('data.0.franchise_user_id', $manager->id)
            ->assertJsonPath('data.0.franchise_operator.name', 'Activity Manager')
            ->assertJsonPath('data.0.payment_method', 'cash')
            ->assertJsonPath('summary.sales_count', 1)
            ->assertJsonPath('summary.total_sales', 80);

        $this->getJson('/api/franchise/pos/orders?franchise_id='.$otherBranch->id, $headers)
            ->assertForbidden();

        $dashboard = $this->getJson('/api/franchise/dashboard', $headers)->assertOk();
        $dashboard->assertJsonPath('data.inventory_items', 1)
            ->assertJsonPath('data.tracked_inventory_items', 0)
            ->assertJsonPath('data.pos_activity_count', 1)
            ->assertJsonPath('data.pos_sales', 80);

        $cashier = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'Branch Cashier',
            'email' => 'branch.cashier@test',
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $cashierLogin = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Cashier@123',
        ])->assertOk();
        $this->getJson('/api/franchise/pos/orders', [
            'Authorization' => 'Bearer '.$cashierLogin->json('token'),
        ])->assertUnauthorized();
    }

    public function test_manager_can_view_pos_history_without_pos_processing_permission(): void
    {
        $branch = $this->makeBranch('View Only POS Branch');
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'View Only Manager',
            'email' => 'view.manager@test',
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
            'can_process_pos' => false,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer '.$login->json('token')];

        $this->getJson('/api/franchise/pos/orders', $headers)->assertOk();
        $this->postJson('/api/franchise/pos/orders', [], $headers)->assertForbidden();
    }

    public function test_third_party_pos_orders_require_branch_scoped_references_and_ignore_register_payment_fields(): void
    {
        $branch = $this->makeBranch('Third Party POS Branch');
        $otherBranch = $this->makeBranch('Other Third Party POS Branch');
        $manager = $this->makePosManager($branch, 'Third Party Manager', 'third.party.manager@test');
        $otherManager = $this->makePosManager($otherBranch, 'Other Third Party Manager', 'other.third.party.manager@test');
        $product = $this->makePosProduct($branch, 'Third Party Meal');
        $otherProduct = $this->makePosProduct($otherBranch, 'Other Third Party Meal');
        $headers = $this->franchiseHeaders($manager, 'Manager@123');
        $otherHeaders = $this->franchiseHeaders($otherManager, 'Manager@123');

        $basePayload = [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'third_party_platform' => 'foodpanda',
        ];

        $this->postJson('/api/franchise/pos/orders', $basePayload, $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('external_order_ref');

        $sale = $this->postJson('/api/franchise/pos/orders', [
            ...$basePayload,
            'external_order_ref' => 'fp-100',
            'payment_method' => 'cash',
            'payment_reference' => 'SHOULD-BE-IGNORED',
            'cash_tendered' => 1000,
            'discount_type' => 'PWD',
            'discount_id_number' => 'PWD-123',
            'discount_cardholder_name' => 'Test Customer',
            'promo_code' => 'SHOULDNOTAPPLY',
        ], $headers)->assertCreated();

        $saleId = $sale->json('order.id');
        $this->assertDatabaseHas('orders', [
            'id' => $saleId,
            'branch_id' => $branch->id,
            'third_party_platform' => 'foodpanda',
            'external_order_ref' => 'FP-100',
            'payment_method' => 'foodpanda',
            'payment_status' => 'paid',
            'cash_tendered' => null,
            'change_due' => null,
            'discount_type' => null,
            'discount_amount' => null,
            'promo_code' => null,
            'promo_discount' => null,
            'payment_reference' => null,
            'total' => '80.00',
        ]);
        $sale->assertJsonPath('order.third_party_platform', 'foodpanda')
            ->assertJsonPath('order.external_order_ref', 'FP-100')
            ->assertJsonPath('order.delivery_address', 'Onsite - Takeout (Customer: Walk-in Customer)');

        $this->postJson('/api/franchise/pos/orders', [
            ...$basePayload,
            'external_order_ref' => 'FP-100',
        ], $headers)->assertStatus(409)
            ->assertJsonPath('message', 'This platform order number has already been used at this branch.');

        $this->postJson('/api/franchise/pos/orders', [
            'items' => [['product_id' => $otherProduct->id, 'quantity' => 1]],
            'third_party_platform' => 'foodpanda',
            'external_order_ref' => 'FP-100',
        ], $otherHeaders)->assertCreated();

        $this->postJson('/api/franchise/pos/orders', [
            ...$basePayload,
            'third_party_platform' => 'grabfood',
            'external_order_ref' => 'FP-100',
        ], $headers)->assertCreated();
    }

    private function makePosManager(Franchise $branch, string $name, string $email): FranchiseUser
    {
        return FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => $name,
            'email' => $email,
            'password' => Hash::make('Manager@123'),
            'is_active' => true,
            'can_process_pos' => true,
        ]);
    }

    private function makePosProduct(Franchise $branch, string $name): Product
    {
        return Product::create([
            'name' => $name,
            'description' => 'Branch register item',
            'price' => 80,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
    }

    private function franchiseHeaders(FranchiseUser $manager, string $password): array
    {
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => $password,
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('token')];
    }

    private function makeBranch(string $name): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.test',
            'phone' => '09170000000',
            'address' => $name.' address',
            'status' => 'active',
        ]);
    }
}
