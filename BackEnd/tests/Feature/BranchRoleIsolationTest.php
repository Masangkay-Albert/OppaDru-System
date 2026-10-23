<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BranchRoleIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_model_accepts_promo_and_discount_fields_for_mass_assignment(): void
    {
        $order = new Order([
            'email' => 'customer@example.com',
            'franchise_id' => 'OPPA-FR-TEST',
            'branch_id' => 'OPPA-FR-TEST',
            'promo_id' => 'promo-123',
            'promo_code' => 'SAVE10',
            'promo_discount' => 150,
            'discount_type' => 'PWD',
            'discount_rate' => 0.2,
            'discount_amount' => 100,
            'discount_proof_image_data' => 'data:image/png;base64,abc',
            'distance_km' => 4.2,
        ]);

        $this->assertSame('promo-123', $order->promo_id);
        $this->assertSame('SAVE10', $order->promo_code);
        $this->assertSame(150.0, (float) $order->promo_discount);
        $this->assertSame('data:image/png;base64,abc', $order->discount_proof_image_data);
        $this->assertSame(4.2, (float) $order->distance_km);
    }

    public function test_branch_cashier_is_limited_to_own_branch_and_pos_orders_are_attributed(): void
    {
        $branch = $this->makeBranch('Cashier Branch');
        $otherBranch = $this->makeBranch('Other Cashier Branch');
        $cashier = $this->makeEmployee($branch, 'cashier', 'cashier@branch.test');
        $product = $this->makeProduct($branch, 'Branch Meal');
        $otherProduct = $this->makeProduct($otherBranch, 'Other Meal');
        $login = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk();
        $token = $login->json('token');

        $this->getJson('/api/employee/pos/top-products?period=month&limit=5', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertExactJson([]);

        $this->getJson('/api/employee/pos/products', ['Authorization' => 'Bearer ' . $token])
            ->assertOk()
            ->assertJsonFragment(['name' => 'Branch Meal'])
            ->assertJsonMissing(['name' => 'Other Meal']);

        $response = $this->postJson('/api/employee/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'customer_name' => 'Sean',
            'phone' => '',
            'payment_method' => 'cash',
            'cash_tendered' => 200,
            'dining_option' => 'dine_in',
            'table_number' => '12',
        ], ['Authorization' => 'Bearer ' . $token])->assertCreated();

        $this->assertSame('OPPA-ORD-', substr($response->json('order.orderNumber'), 0, 9));
        $this->assertSame('', $response->json('order.phone'));
        $this->assertSame('Table 12', substr($response->json('order.delivery_address'), -8));
        $this->assertSame(80.0, (float) $response->json('order.total'));
        $this->assertSame(8.57, (float) $response->json('order.vat'));
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'franchise_id' => $branch->id,
            'branch_id' => $branch->id,
            'cashier_employee_id' => $cashier->id,
        ]);
        $this->getJson('/api/employee/pos/top-products?period=month&limit=5', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('0.qtySold', 1);
        $this->getJson('/api/employee/pos/orders', ['Authorization' => 'Bearer ' . $token])
            ->assertOk()
            ->assertJsonPath('data.0.id', $response->json('order.id'));
        $this->getJson('/api/employee/pos/products?franchise_id=' . $otherBranch->id, [
            'Authorization' => 'Bearer ' . $token,
        ])->assertForbidden();
        $this->assertNotSame($product->id, $otherProduct->id);
    }

    public function test_employee_logins_keep_independent_branch_sessions(): void
    {
        $branch = $this->makeBranch('Independent Session Branch');
        $cashier = $this->makeEmployee($branch, 'cashier', 'independent.session@branch.test');

        $firstToken = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk()->json('token');
        $secondToken = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk()->json('token');

        $this->assertNotSame($firstToken, $secondToken);
        $this->getJson('/api/employee/pos/products', [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertOk();
        $this->getJson('/api/employee/pos/products', [
            'Authorization' => 'Bearer '.$secondToken,
        ])->assertOk();

        $this->postJson('/api/employee/logout', [], [
            'Authorization' => 'Bearer '.$secondToken,
        ])->assertOk();

        $this->getJson('/api/employee/pos/products', [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertOk();
        $this->getJson('/api/employee/pos/products', [
            'Authorization' => 'Bearer '.$secondToken,
        ])->assertUnauthorized();
    }

    public function test_employee_pos_calculates_senior_discount_from_db_price_and_exempts_vat(): void
    {
        $branch = $this->makeBranch('Senior Discount Branch');
        $cashier = $this->makeEmployee($branch, 'cashier', 'senior.discount@branch.test');
        $product = $this->makeProduct($branch, 'Senior Discount Meal');
        $product->update(['price' => 1120]);
        $login = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk();

        $response = $this->postJson('/api/employee/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'cash',
            'cash_tendered' => 900,
            'dining_option' => 'takeout',
            'discount_type' => 'Senior Citizen',
            'discount_id_number' => 'SC-12345',
            'total' => 1,
            'vat' => 99,
        ], ['Authorization' => 'Bearer '.$login->json('token')])->assertCreated();

        $this->assertSame(800.0, (float) $response->json('order.total'));
        $this->assertSame(200.0, (float) $response->json('order.discount_amount'));
        $this->assertSame(0.0, (float) $response->json('order.vat'));
    }

    public function test_employee_pos_rejects_invalid_order_payload_with_clear_bad_request(): void
    {
        $branch = $this->makeBranch('Invalid POS Payload Branch');
        $cashier = $this->makeEmployee($branch, 'cashier', 'invalid.pos@branch.test');
        $token = $this->tokenEmployee($cashier);

        $this->postJson('/api/employee/pos/orders', [
            'items' => [],
            'dining_option' => 'Dine-in',
            'payment_method' => 'Cash',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertBadRequest()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Please check the POS order details.');
    }

    public function test_manager_without_pos_permission_cannot_process_orders_and_branch_staff_creation_is_scoped(): void
    {
        $branch = $this->makeBranch('Manager Branch');
        $otherBranch = $this->makeBranch('Unrelated Branch');
        $manager = FranchiseUser::create([
            'franchise_id' => $branch->id,
            'full_name' => 'Branch Manager',
            'email' => 'manager@branch.test',
            'password' => Hash::make('Manager@123'),
            'role' => 'manager',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/franchise/login', [
            'email' => $manager->email,
            'password' => 'Manager@123',
        ])->assertOk();
        $headers = ['Authorization' => 'Bearer ' . $login->json('token')];

        $this->postJson('/api/franchise/pos/orders', [], $headers)->assertForbidden();

        $this->postJson('/api/franchise/users', [
            'name' => 'Branch Cashier',
            'email' => 'staff@branch.test',
            'password' => 'Staff@123',
            'role' => 'cashier',
            'franchise_id' => $otherBranch->id,
        ], $headers)->assertForbidden();
        $this->assertDatabaseMissing('employees', ['email' => 'staff@branch.test']);

        $created = $this->postJson('/api/franchise/users', [
            'name' => 'Branch Cashier',
            'email' => 'staff@branch.test',
            'password' => 'Staff@123',
            'role' => 'cashier',
        ], $headers)->assertCreated();
        $this->assertDatabaseHas('employees', [
            'id' => $created->json('data.id'),
            'franchise_id' => $branch->id,
            'position' => 'cashier',
        ]);
        $this->postJson('/api/franchise/users', [
            'name' => 'Another Manager',
            'email' => 'manager2@branch.test',
            'password' => 'Manager@456',
            'role' => 'manager',
        ], $headers)->assertUnprocessable();
    }

    public function test_branch_cashier_can_record_card_terminal_payment_and_cutlery_selection(): void
    {
        $branch = $this->makeBranch('Card POS Branch');
        $cashier = $this->makeEmployee($branch, 'cashier', 'card-cashier@branch.test');
        $product = $this->makeProduct($branch, 'Card Meal');
        $login = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk();

        $response = $this->postJson('/api/employee/pos/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'credit_card',
            'terminal_reference' => 'TERMINAL-REF-2081',
            'dining_option' => 'dine_in',
            'include_cutlery' => true,
        ], ['Authorization' => 'Bearer ' . $login->json('token')])->assertCreated();

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'franchise_id' => $branch->id,
            'cashier_employee_id' => $cashier->id,
            'payment_method' => 'credit_card',
            'payment_reference' => 'TERMINAL-REF-2081',
            'include_cutlery' => true,
        ]);
    }

    public function test_driver_sees_only_own_branch_delivery_data_without_financial_fields(): void
    {
        $branch = $this->makeBranch('Driver Branch');
        $branch->update(['latitude' => 14.5, 'longitude' => 121.0]);
        $otherBranch = $this->makeBranch('Other Driver Branch');
        $driver = $this->makeDriver($branch, 'driver@branch.test');
        $ownOrder = $this->makeDelivery($branch, 'DRIVER-OWN-ORDER');
        $otherOrder = $this->makeDelivery($otherBranch, 'DRIVER-OTHER-ORDER');
        $token = $this->tokenDriver($driver);

        $response = $this->getJson('/api/driver/orders?tab=available', [
            'Authorization' => 'Bearer ' . $token,
        ])->assertOk();

        $this->assertSame([$ownOrder->id], collect($response->json())->pluck('id')->all());
        $this->assertSame($ownOrder->order_number, $response->json()[0]['order_number']);
        $this->assertSame('Driver Branch', $response->json()[0]['branchName']);
        $this->assertSame(['lat' => 14.5, 'lng' => 121], $response->json()[0]['branchCoordinates']);
        $this->assertArrayNotHasKey('total', $response->json()[0]);
        $this->assertArrayNotHasKey('paymentMethod', $response->json()[0]);
        $this->assertArrayNotHasKey('product_price', $response->json()[0]['items'][0]);
        $this->patchJson('/api/driver/orders/' . $otherOrder->id . '/status', [
            'status' => 'on_the_way',
        ], ['Authorization' => 'Bearer ' . $token])->assertNotFound();
    }

    public function test_driver_cannot_upload_proof_for_another_branches_order(): void
    {
        Storage::fake('public');
        $branch = $this->makeBranch('Proof Driver Branch');
        $otherBranch = $this->makeBranch('Other Proof Branch');
        $driver = $this->makeDriver($branch, 'proof-driver@branch.test');
        $otherDriver = $this->makeDriver($otherBranch, 'other-proof-driver@branch.test');
        $otherOrder = $this->makeDelivery($otherBranch, 'PROOF-OTHER-ORDER');
        $otherOrder->update(['driver_id' => $otherDriver->id, 'status' => 'on_the_way']);
        $token = $this->tokenDriver($driver);

        $this->post('/api/driver/orders/' . $otherOrder->id . '/delivery-proof', [
            'proof_image' => UploadedFile::fake()->createWithContent(
                'proof.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S88AAAAASUVORK5CYII=', true) ?: ''
            ),
        ], ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'])
            ->assertNotFound();
    }

    public function test_driver_can_see_branch_id_orders_in_available_tab(): void
    {
        $branch = $this->makeBranch('Branch ID Driver Branch');
        $driver = $this->makeDriver($branch, 'branch-id-driver@branch.test');
        $token = $this->tokenDriver($driver);

        $order = Order::create([
            'id' => 'BRANCH-ID-ORDER',
            'branch_id' => $branch->id,
            'franchise_id' => null,
            'email' => 'customer@example.test',
            'order_number' => 'BRANCH-ID-ORDER',
            'total' => 250,
            'status' => 'prepared',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000003',
            'items' => [['product_name' => 'Meal', 'product_price' => 250, 'quantity' => 1]],
            'delivery_type' => 'standard',
            'delivery_calculation_method' => 'base_fee_plus_distance_rate_capped',
        ]);

        $response = $this->getJson('/api/driver/orders?tab=available', [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertOk();
        $this->assertContains($order->id, collect($response->json())->pluck('id')->all());
    }

    public function test_staff_admin_apis_reject_requests_without_admin_token(): void
    {
        $this->getJson('/api/employees')->assertUnauthorized();
        $this->getJson('/api/drivers')->assertUnauthorized();
    }

    public function test_kitchen_staff_only_receives_orders_and_nonfinancial_items_for_own_branch(): void
    {
        $branch = $this->makeBranch('Kitchen Branch');
        $otherBranch = $this->makeBranch('Other Kitchen Branch');
        $kitchen = $this->makeEmployee($branch, 'kitchen_staff', 'kitchen@branch.test');
        $this->makeEmployee($otherBranch, 'kitchen_staff', 'kitchen@other.test');
        $ownOrder = $this->makeDelivery($branch, 'KITCHEN-OWN-ORDER');
        $ownOrder->update(['status' => 'pending']);
        $otherOrder = $this->makeDelivery($otherBranch, 'KITCHEN-OTHER-ORDER');
        $otherOrder->update(['status' => 'pending']);
        $token = $this->tokenEmployee($kitchen);

        $response = $this->getJson('/api/kitchen/orders?tab=pending', [
            'Authorization' => 'Bearer ' . $token,
        ])->assertOk();

        $this->assertSame(['KITCHEN-OWN-ORDER'], collect($response->json())->pluck('id')->all());
        $this->assertSame($ownOrder->order_number, $response->json()[0]['order_number']);
        $this->assertArrayNotHasKey('total', $response->json()[0]);
        $this->assertArrayNotHasKey('product_price', $response->json()[0]['items'][0]);
        $this->getJson('/api/employee/pos/products', [
            'Authorization' => 'Bearer ' . $token,
        ])->assertForbidden();
    }

    private function makeBranch(string $name): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)) . '@example.test',
            'phone' => '09170000000',
            'address' => $name . ' address',
            'status' => 'active',
        ]);
    }

    private function makeEmployee(Franchise $branch, string $role, string $email): Employee
    {
        return Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => ucfirst($role),
            'email' => $email,
            'password' => Hash::make('Staff@123'),
            'position' => $role === 'kitchen_staff' ? 'kitchen staff' : $role,
            'is_active' => true,
        ]);
    }

    private function tokenEmployee(Employee $employee): string
    {
        $token = 'branch-staff-token-' . $employee->id;
        $employee->api_token = hash('sha256', $token);
        $employee->save();
        return $token;
    }

    private function makeDriver(Franchise $branch, string $email): Driver
    {
        return Driver::create([
            'franchise_id' => $branch->id,
            'name' => 'Branch Driver',
            'email' => $email,
            'password' => 'Driver@123',
            'phone' => '09170000001',
            'vehicleType' => 'Motorcycle',
            'isActive' => true,
        ]);
    }

    private function tokenDriver(Driver $driver): string
    {
        $token = 'branch-driver-token-' . $driver->id;
        $driver->api_token = hash('sha256', $token);
        $driver->save();
        return $token;
    }

    private function makeProduct(Franchise $branch, string $name): Product
    {
        $product = Product::create([
            'name' => $name,
            'description' => 'Test branch product',
            'price' => 80,
            'category' => 'rice-meals',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        app(\App\Services\FranchiseInventoryService::class)->initializeBranchMenu((string) $branch->id);

        return $product;
    }

    private function makeDelivery(Franchise $branch, string $id): Order
    {
        return Order::create([
            'id' => $id,
            'franchise_id' => $branch->id,
            'email' => 'customer@example.test',
            'order_number' => $id,
            'total' => 250,
            'status' => 'prepared',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000002',
            'items' => [['product_name' => 'Meal', 'product_price' => 250, 'quantity' => 1]],
            'delivery_type' => 'standard',
            'delivery_calculation_method' => 'base_fee_plus_distance_rate_capped',
        ]);
    }
}
