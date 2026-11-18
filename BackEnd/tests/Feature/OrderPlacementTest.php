<?php

namespace Tests\Feature;

use App\Models\DiscountApplication;
use App\Models\DiscountVerificationRequest;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Employee;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseInventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Promo;
use App\Models\Product;
use App\Models\Driver;
use App\Models\User;
use App\Notifications\DiscountApplicationDecisionNotification;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderPlacementTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_customer_can_cancel_a_pending_order_within_thirty_seconds(): void
    {
        $customer = User::create([
            'full_name' => 'Cancellation Customer',
            'email' => 'cancellation@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-CANCEL-30S',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        Carbon::setTestNow($order->created_at->copy()->addSeconds(29));
        $this->actingAs($customer, 'api')
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('order.status', 'cancelled');

        Carbon::setTestNow();
    }

    public function test_customer_cannot_cancel_a_pending_order_at_thirty_seconds(): void
    {
        $customer = User::create([
            'full_name' => 'Late Cancellation Customer',
            'email' => 'late-cancellation@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-CANCEL-31S',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        Carbon::setTestNow($order->created_at->copy()->addSeconds(30));
        $this->actingAs($customer, 'api')
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'cancelled'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Cancellation period has ended.');
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'pending']);

        Carbon::setTestNow();
    }

    public function test_customer_order_response_includes_server_calculated_cancellation_time(): void
    {
        $customer = User::create([
            'full_name' => 'Countdown Customer',
            'email' => 'countdown@example.com',
            'phone' => '09171234569',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-CANCEL-COUNTDOWN',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        Carbon::setTestNow($order->created_at->copy()->addSeconds(12));
        $this->actingAs($customer, 'api')
            ->getJson('/api/orders/user/'.$order->id)
            ->assertOk()
            ->assertJsonPath('cancellation_remaining_seconds', 18);

        Carbon::setTestNow();
    }

    public function test_customer_can_skip_cancellation_window_without_starting_preparation(): void
    {
        $customer = User::create([
            'full_name' => 'Proceed Customer',
            'email' => 'proceed@example.com',
            'phone' => '09171234571',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-PROCEED-PENDING',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        Carbon::setTestNow($order->created_at->copy()->addSeconds(5));
        $this->actingAs($customer, 'api')
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'proceed'])
            ->assertOk()
            ->assertJsonPath('order.status', 'pending');

        $order->refresh();
        $this->assertNotNull($order->customer_proceeded_at);
        $this->assertSame('pending', $order->status);

        $this->getJson('/api/orders/user/'.$order->id)
            ->assertOk()
            ->assertJsonPath('cancellation_remaining_seconds', 0);

        $this->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'cancelled'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Cancellation period has ended.');
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'pending']);

        Carbon::setTestNow();
    }

    public function test_customer_cannot_set_an_order_to_preparing(): void
    {
        $customer = User::create([
            'full_name' => 'Status Guard Customer',
            'email' => 'status-guard@example.com',
            'phone' => '09171234572',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-CANNOT-START-PREPARING',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        $this->actingAs($customer, 'api')
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'preparing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'pending']);
    }

    public function test_customer_cannot_cancel_after_order_status_has_advanced(): void
    {
        $customer = User::create([
            'full_name' => 'Started Order Customer',
            'email' => 'started-order@example.com',
            'phone' => '09171234570',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $order = Order::create([
            'id' => 'CUSTOMER-CANCEL-STARTED',
            'email' => $customer->email,
            'user_id' => $customer->id,
            'total' => 100,
            'status' => 'preparing',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Test delivery address',
            'phone' => $customer->phone,
            'items' => [],
            'delivery_type' => 'standard',
        ]);

        $this->actingAs($customer, 'api')
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'cancelled'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This order has already started and can no longer be cancelled.');
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'preparing']);
    }

    public function test_main_system_onsite_order_is_assigned_to_the_main_branch(): void
    {
        $mainBranch = Franchise::create([
            'name' => 'Main System',
            'status' => 'active',
            'is_main' => true,
            'is_active' => true,
        ]);
        $product = Product::create([
            'name' => 'Walk-in Chicken',
            'description' => 'Main system POS item',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $mainBranch->id,
            'is_available' => true,
        ]);
        $cashier = Employee::create([
            'franchise_id' => $mainBranch->id,
            'fullName' => 'Main Branch Cashier',
            'email' => 'main-cashier@example.test',
            'password' => Hash::make('Staff@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $login = $this->postJson('/api/employee/login', [
            'email' => $cashier->email,
            'password' => 'Staff@123',
        ])->assertOk();

        $response = $this->postJson('/api/employee/pos/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
            'payment_method' => 'cash',
            'dining_option' => 'takeout',
            'cash_tendered' => 199,
        ], ['Authorization' => 'Bearer '.$login->json('token')])->assertCreated()
            ->assertJsonPath('order.branch_id', $mainBranch->id)
            ->assertJsonPath('order.branch_name', 'Main System')
            ->assertJsonPath('order.franchise_id', $mainBranch->id);

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'branch_id' => $mainBranch->id,
            'franchise_id' => $mainBranch->id,
        ]);
    }

    public function test_customer_can_login_and_place_an_order(): void
    {
        $user = User::create([
            'full_name' => 'Test Customer',
            'email' => 'customer@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        Franchise::create([
            'name' => 'Order Test Branch',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 15,
        ]);

        $product = Product::create([
            'name' => 'Soy Garlic Chicken',
            'description' => 'Crispy Korean fried chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'soygarlic-chicken.jpg',
            'is_available' => true,
        ]);
        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $loginResponse
            ->assertOk()
            ->assertJsonStructure(['user', 'token', 'message']);

        $orderResponse = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'product_price' => 199,
                        'quantity' => 2,
                    ],
                ],
                'total' => 0,
                'delivery_address' => 'Block 1, Lot 2, Dasmarinas, Cavite',
                'delivery_instructions' => [
                    'block' => '1',
                    'lot' => '2',
                    'street' => 'Mabini Street',
                    'floor' => '2nd',
                    'unit' => 'A',
                    'building' => 'Building A',
                    'note' => 'Gate code 1234',
                ],
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171234567',
                'include_cutlery' => 'false',
            ]);
        $orderResponse
            ->assertCreated()
            ->assertJsonPath('order.email', $user->email)
            ->assertJsonPath('order.total', '462.00')
            ->assertJsonPath('order.delivery_fee', '49.00')
            ->assertJsonPath('order.service_fee', '15.00')
            ->assertJsonPath('order.items.0.product_id', $product->id)
            ->assertJsonPath('order.delivery_instructions.floor', '2nd')
            ->assertJsonPath('order.delivery_instructions.unit', 'A')
            ->assertJsonPath('order.delivery_instructions.building', 'Building A')
            ->assertJsonPath('order.delivery_instructions.note', 'Gate code 1234')
            ->assertJsonPath('order.include_cutlery', false);

        $this->assertDatabaseHas('orders', [
            'id' => $orderResponse->json('order.id'),
            'include_cutlery' => false,
        ]);
        $this->getJson('/api/orders/user')
            ->assertOk()
            ->assertJsonPath('0.id', $orderResponse->json('order.id'))
            ->assertJsonPath('0.delivery_type', 'standard')
            ->assertJsonPath('0.delivery_instructions.note', 'Gate code 1234');
    }

    public function test_customer_order_history_uses_the_authenticated_account(): void
    {
        $user = User::create([
            'full_name' => 'Authenticated Customer',
            'email' => 'authenticated@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        Franchise::create([
            'name' => 'Order History Test Branch',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 15,
        ]);

        $product = Product::create([
            'name' => 'Authenticated Chicken',
            'description' => 'Test chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);

        $response = $this->actingAs($user, 'api')
            ->postJson('/api/orders', [
                'email' => 'different@example.com',
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Authenticated customer address',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171234567',
            ])
            ->assertCreated()
            ->assertJsonPath('order.email', $user->email);

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        $this->getJson('/api/orders/user')
            ->assertOk()
            ->assertJsonPath('0.id', $response->json('order.id'));
    }

    public function test_customer_order_tracking_is_owned_and_returns_status_history(): void
    {
        $owner = User::create([
            'full_name' => 'Tracking Owner',
            'email' => 'tracking-owner@example.com',
            'phone' => '09170000001',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $otherCustomer = User::create([
            'full_name' => 'Other Customer',
            'email' => 'other-customer@example.com',
            'phone' => '09170000002',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
        $ownedOrder = Order::create([
            'user_id' => $owner->id,
            'email' => $owner->email,
            'total' => 100,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Santa Rosa, Laguna',
            'phone' => $owner->phone,
            'items' => [['product_id' => 'item-1', 'product_name' => 'Chicken', 'product_price' => 100, 'quantity' => 1]],
        ]);
        $otherOrder = Order::create([
            'user_id' => $otherCustomer->id,
            'email' => $otherCustomer->email,
            'total' => 200,
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Dasmarinas, Cavite',
            'phone' => $otherCustomer->phone,
            'items' => [['product_id' => 'item-2', 'product_name' => 'Chicken', 'product_price' => 200, 'quantity' => 1]],
        ]);
        $ownedOrder->status = 'preparing';
        $ownedOrder->save();

        $this->actingAs($owner, 'api')
            ->getJson('/api/orders/user/'.$ownedOrder->id)
            ->assertOk()
            ->assertJsonPath('id', $ownedOrder->id)
            ->assertJsonPath('status', 'preparing')
            ->assertJsonPath('status_history.0.status', 'pending')
            ->assertJsonPath('status_history.1.status', 'preparing');

        $this->getJson('/api/orders/user/'.$otherOrder->id)->assertNotFound();
        $this->getJson('/api/orders/'.$otherOrder->id)->assertNotFound();
    }

    public function test_cod_order_is_counted_only_after_delivery_and_only_once(): void
    {
        $this->createOnlineDeliveryBranch('COD Order Branch');
        $user = User::create([
            'full_name' => 'COD Customer',
            'email' => 'cod-customer@example.com',
            'phone' => '09171234569',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $product = Product::create([
            'name' => 'COD Chicken',
            'description' => 'Test chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);
        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'COD delivery address',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ]);

        $response->assertCreated()->assertJsonPath('order.payment_status', 'pending');
        $order = Order::findOrFail($response->json('order.id'));

        $this->assertSame(0.0, (float) Order::countedAsRevenue()->sum('total'));

        $order->status = 'delivered';
        $order->save();
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(263.0, (float) Order::countedAsRevenue()->sum('total'));

        $order->save();
        $this->assertSame(263.0, (float) Order::countedAsRevenue()->sum('total'));

        $order->status = 'cancelled';
        $order->save();
        $this->assertSame(0.0, (float) Order::countedAsRevenue()->sum('total'));
    }

    public function test_only_paid_or_delivered_cod_orders_are_counted_as_revenue(): void
    {
        $paidCardOrder = Order::create([
            'email' => 'card-customer@example.com',
            'total' => 725,
            'status' => 'pending',
            'payment_method' => 'credit_card',
            'payment_status' => 'paid',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000000',
            'items' => [],
        ]);
        Order::create([
            'email' => 'failed-customer@example.com',
            'total' => 199,
            'status' => 'pending',
            'payment_method' => 'gcash',
            'payment_status' => 'failed',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000000',
            'items' => [],
        ]);
        Order::create([
            'email' => 'cancelled-customer@example.com',
            'total' => 299,
            'status' => 'cancelled',
            'payment_method' => 'gcash',
            'payment_status' => 'paid',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000000',
            'items' => [],
        ]);

        $this->assertSame(725.0, (float) Order::countedAsRevenue()->sum('total'));
        $this->assertTrue($paidCardOrder->isCountedAsRevenue());
    }

    public function test_successful_online_payment_is_saved_as_paid_at_the_rounded_order_total(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-18 15:30:00', 'UTC'));
        $branch = $this->createOnlineDeliveryBranch('Online Payment Branch');
        $user = User::create([
            'full_name' => 'GCash Customer',
            'email' => 'gcash-customer@example.com',
            'phone' => '09171234570',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $product = Product::create([
            'name' => 'GCash Chicken',
            'description' => 'Test chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);
        $payment = Payment::create([
            'reference' => 'GCASH-PAID-TEST',
            'provider' => 'test',
            'amount' => 263,
            'status' => 'paid',
            'paid_at' => now(),
            'metadata' => ['franchise_id' => $branch->id],
        ]);
        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 263,
                'delivery_address' => 'Online payment delivery address',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'gcash',
                'payment_reference' => $payment->reference,
                'phone' => $user->phone,
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.total', '263.00')
            ->assertJsonPath('order.payment_status', 'paid');
        $this->assertSame(263.0, (float) Order::countedAsRevenue()->sum('total'));
        $this->assertSame($response->json('order.id'), $payment->fresh()->order_id);

        $cardPayment = Payment::create([
            'reference' => 'CARD-PAID-TEST',
            'provider' => 'test',
            'amount' => 263,
            'status' => 'paid',
            'paid_at' => now(),
            'metadata' => ['franchise_id' => $branch->id],
        ]);
        $cardResponse = $this
            ->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 263,
                'delivery_address' => 'Online payment delivery address',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'credit_card',
                'payment_reference' => $cardPayment->reference,
                'phone' => $user->phone,
            ]);

        $cardResponse->assertCreated()->assertJsonPath('order.payment_status', 'paid');
        $this->assertSame($cardResponse->json('order.id'), $cardPayment->fresh()->order_id);

        $this->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 263,
                'delivery_address' => 'Online payment delivery address',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', "Sorry, we're not accepting orders right now. Ordering is open from 11:00 AM to 10:30 PM.");
    }

    public function test_gcash_and_card_amount_validation_rejects_drink_sizes_and_addons(): void
    {
        config()->set('services.paymongo.secret_key', null);
        $user = User::create([
            'full_name' => 'Payment Customer',
            'email' => 'payment-customer@example.com',
            'phone' => '09171234571',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $product = Product::create([
            'name' => 'Payment drink',
            'description' => 'Test drink',
            'price' => 100,
            'category' => 'fruity-soda-milk',
            'image' => '',
            'is_available' => true,
        ]);
        $addonGroup = AddonGroup::create([
            'name' => 'Payment topping',
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
        $branch = Franchise::create([
            'name' => 'Payment Test Branch',
            'status' => 'active',
            'is_active' => true,
            'latitude' => 14.3194,
            'longitude' => 120.9943,
        ]);
        $item = [
            'product_id' => $product->id,
            'quantity' => 3,
            'selected_size' => 'Small',
        ];
        $pricingPayload = [
            'amount' => 400,
            'items' => [$item],
            'delivery_type' => 'standard',
            'fulfillment_type' => 'pickup',
            'franchise_id' => $branch->id,
            'voucher_discount' => 0,
            'discount_rate' => 0,
        ];

        $this->postJson('/api/payment/gcash/create', $pricingPayload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Size options are not available for this item.');

        $pricingPayload['items'][0] = [
            'product_id' => $product->id,
            'quantity' => 3,
            'selected_addons' => [['id' => $addon->id, 'quantity' => 2]],
        ];
        $this->postJson('/api/payment/gcash/create', $pricingPayload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Add-ons are not available for this item.');

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);
        $this->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/payment/card/process', $pricingPayload + [
                'card_number' => '4242424242424242',
                'card_holder_name' => 'Payment Customer',
                'expiry_month' => '12',
                'expiry_year' => (string) (now()->year + 2),
                'cvv' => '123',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Add-ons are not available for this item.');

        $this->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 99,
                    'quantity' => 1,
                    'selected_size' => 'Medium',
                ]],
                'delivery_address' => 'Payment Test Branch',
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
                'fulfillment_type' => 'pickup',
                'franchise_id' => $branch->id,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Size options are not available for this item.');
    }

    public function test_failed_payments_are_never_counted_even_for_delivered_cod_orders(): void
    {
        Order::create([
            'email' => 'failed-cod@example.com',
            'total' => 199,
            'status' => 'delivered',
            'payment_method' => 'cash_on_delivery',
            'payment_status' => 'failed',
            'delivery_address' => 'Delivery address',
            'phone' => '09170000000',
            'items' => [],
        ]);

        $this->assertSame(0.0, (float) Order::countedAsRevenue()->sum('total'));
    }

    public function test_checkout_rejects_a_product_owned_by_another_branch(): void
    {
        $user = User::create([
            'full_name' => 'Branch Checkout Customer',
            'email' => 'branch-checkout@example.com',
            'phone' => '09171234569',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $cavite = Franchise::create([
            'name' => 'Cavite Checkout Branch',
            'status' => 'active',
            'is_active' => true,
            'accepts_online_orders' => true,
            'latitude' => 14.3194,
            'longitude' => 120.9943,
        ]);
        $bulacan = Franchise::create([
            'name' => 'Bulacan Checkout Branch',
            'status' => 'active',
        ]);
        $bulacanProduct = Product::create([
            'name' => 'Bulacan Only Product',
            'description' => 'Not available to Cavite',
            'price' => 120,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $bulacan->id,
            'is_available' => true,
        ]);
        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ])->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$login->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'franchise_id' => $cavite->id,
                'fulfillment_type' => 'pickup',
                'items' => [[
                    'product_id' => $bulacanProduct->id,
                    'product_name' => $bulacanProduct->name,
                    'product_price' => 120,
                    'quantity' => 1,
                ]],
                'total' => 120,
                'delivery_address' => 'Cavite Branch',
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('unavailable_items.0', 'Bulacan Only Product');
    }

    public function test_customer_branch_order_is_validated_and_saved_to_that_branch(): void
    {
        $user = User::create([
            'full_name' => 'Branch Customer',
            'email' => 'branch-customer@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $branch = Franchise::create([
            'name' => 'Central Branch',
            'email' => 'central@example.com',
            'phone' => '09170000006',
            'address' => 'Central St',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 15,
        ]);
        $product = Product::create([
            'name' => 'Central Branch Chicken',
            'description' => 'Branch-specific menu item',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        FranchiseInventory::create([
            'franchise_id' => $branch->id,
            'product_id' => $product->id,
            'stock_quantity' => 1,
            'is_available' => true,
        ]);
        Promo::create([
            'code' => 'TEST10',
            'title' => 'Test discount',
            'discount_type' => 'fixed',
            'discount_value' => 10,
            'is_active' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer ' . $loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'franchise_id' => $branch->id,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Central St, Dasmarinas, Cavite',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
                'promo_code' => 'TEST10',
                'promo_discount' => 10,
            ]);
        $response->assertCreated();
        $this->assertSame($branch->id, $response->json('order.franchise_id'));
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'franchise_id' => $branch->id,
            'promo_code' => 'TEST10',
            'promo_discount' => 10,
        ]);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $branch->id,
            'product_id' => $product->id,
            'stock_quantity' => 0,
        ]);

        $otherBranch = Franchise::create([
            'name' => 'Remote Branch',
            'email' => 'remote@example.com',
            'phone' => '09170000007',
            'address' => 'Remote St',
            'status' => 'active',
        ]);
        $otherProduct = Product::create([
            'name' => 'Remote Branch Chicken',
            'description' => 'Must not be orderable from Central',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $otherBranch->id,
            'is_available' => true,
        ]);

        $this->postJson('/api/orders', [
            'email' => $user->email,
            'franchise_id' => $branch->id,
            'items' => [[
                'product_id' => $otherProduct->id,
                'product_name' => $otherProduct->name,
                'product_price' => 199,
                'quantity' => 1,
            ]],
            'total' => 0,
            'delivery_address' => 'Central St, Dasmarinas, Cavite',
            'payment_method' => 'cash_on_delivery',
            'phone' => $user->phone,
        ])->assertUnprocessable();
    }

    public function test_delivery_orders_are_re_resolved_and_tracking_uses_the_saved_nearest_branch(): void
    {
        $user = User::create([
            'full_name' => 'Routing Customer',
            'email' => 'routing-customer@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $caviteAccount = FranchiseAccount::create([
            'name' => 'Cavite Franchise Account',
            'status' => 'active',
        ]);
        $cavite = Franchise::create([
            'name' => 'Cavite branch', 'address' => 'Langkaan II, Dasmariñas', 'status' => 'active',
            'latitude' => '14.3167000', 'longitude' => '120.9333000', 'is_active' => true,
            'franchise_account_id' => $caviteAccount->id,
            'accepts_online_orders' => true, 'delivery_enabled' => true, 'delivery_radius_km' => null,
        ]);
        $laguna = Franchise::create([
            'name' => 'Laguna branch', 'address' => 'Santa Rosa, Laguna', 'status' => 'active',
            'latitude' => '14.2729670', 'longitude' => '121.0931420', 'is_active' => true,
            'accepts_online_orders' => true, 'delivery_enabled' => true, 'delivery_radius_km' => null,
        ]);
        $product = Product::create([
            'name' => 'Routing order chicken', 'description' => 'Branch routing order test',
            'price' => 199, 'category' => 'chicken', 'image' => '', 'is_available' => true,
        ]);
        foreach ([$cavite, $laguna] as $branch) {
            FranchiseInventory::create([
                'franchise_id' => $branch->id,
                'product_id' => $product->id,
                'stock_quantity' => null,
                'is_available' => true,
            ]);
        }

        $login = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ])->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$login->json('token'));
        foreach ([
            [['lat' => 14.3194939, 'lng' => 120.9943268], $cavite],
            [['lat' => 14.272967, 'lng' => 121.093142], $laguna],
        ] as [$coordinates, $expectedBranch]) {
            $response = $this->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'delivery_address' => 'Pinned delivery address',
                'delivery_coordinates' => $coordinates,
                'fulfillment_type' => 'delivery',
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ])->assertCreated()
                ->assertJsonPath('order.branch_id', $expectedBranch->id)
                ->assertJsonPath('order.franchise_account_id', $expectedBranch->franchise_account_id)
                ->assertJsonPath('order.delivery_lat', null)
                ->assertJsonPath('order.delivery_lng', null)
                ->assertJsonPath('order.delivery_coordinates.lat', $coordinates['lat'])
                ->assertJsonPath('order.delivery_coordinates.lng', $coordinates['lng'])
                ->assertJsonPath('order.branch.id', $expectedBranch->id)
                ->assertJsonPath('order.branch.name', $expectedBranch->name);

            $orderId = $response->json('order.id');
            $this->assertDatabaseHas('orders', [
                'id' => $orderId,
                'branch_id' => $expectedBranch->id,
                'franchise_account_id' => $expectedBranch->franchise_account_id,
                'delivery_lat' => null,
                'delivery_lng' => null,
            ]);
            $this->assertSame($coordinates, Order::findOrFail($orderId)->delivery_coordinates);
            $this->getJson('/api/orders/user/'.$orderId)
                ->assertOk()
                ->assertJsonPath('franchise_account_id', $expectedBranch->franchise_account_id)
                ->assertJsonPath('branch.id', $expectedBranch->id)
                ->assertJsonPath('branch.latitude', $expectedBranch->latitude)
                ->assertJsonPath('branch.longitude', $expectedBranch->longitude)
                ->assertJsonPath('delivery_coordinates.lat', $coordinates['lat'])
                ->assertJsonPath('delivery_coordinates.lng', $coordinates['lng'])
                ->assertJsonPath('status_history.0.status', 'pending');
        }
    }

    public function test_order_api_rejects_addresses_outside_the_ten_kilometer_radius_without_creating_orders(): void
    {
        $user = User::create([
            'full_name' => 'Out of Range Customer',
            'email' => 'out-of-range@example.com',
            'phone' => '09171234570',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $branch = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'latitude' => 14.3167,
            'longitude' => 120.9333,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 50,
        ]);
        $product = Product::create([
            'name' => 'Out of Range Chicken',
            'description' => 'Test product',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);

        $this->actingAs($user, 'api')
            ->postJson('/api/orders', [
                'email' => $user->email,
                'franchise_id' => $branch->id,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Remote address',
                'delivery_coordinates' => ['lat' => 14.50, 'lng' => 120.9333],
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'OUT_OF_RANGE')
            ->assertJsonPath('title', 'Address is outside our delivery area');

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_order_api_rejects_a_cart_branch_that_differs_from_the_serving_branch(): void
    {
        $user = User::create([
            'full_name' => 'Branch Mismatch Customer',
            'email' => 'branch-mismatch@example.com',
            'phone' => '09171234571',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $cavite = Franchise::create([
            'name' => 'Cavite Branch',
            'status' => 'active',
            'latitude' => 14.3167,
            'longitude' => 120.9333,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 10,
        ]);
        $laguna = Franchise::create([
            'name' => 'Laguna Branch',
            'status' => 'active',
            'latitude' => 14.272967,
            'longitude' => 121.093142,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 10,
        ]);
        $product = Product::create([
            'name' => 'Branch Mismatch Chicken',
            'description' => 'Test product',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);

        $this->actingAs($user, 'api')
            ->postJson('/api/orders', [
                'email' => $user->email,
                'franchise_id' => $cavite->id,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Santa Rosa, Laguna',
                'delivery_coordinates' => ['lat' => 14.272967, 'lng' => 121.093142],
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'BRANCH_MISMATCH')
            ->assertJsonPath('serving_branch.name', 'Laguna Branch');

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_franchise_customer_order_links_branch_payment_to_exact_order(): void
    {
        $branch = Franchise::create([
            'name' => 'Payment Link Branch',
            'email' => 'payment-link@example.com',
            'phone' => '09170000008',
            'address' => 'Payment Link St',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 10,
        ]);
        $product = Product::create([
            'name' => 'Payment Link Meal',
            'description' => 'Branch payment link test',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $customer = User::create([
            'full_name' => 'Payment Link Customer',
            'email' => 'payment-link-customer@example.com',
            'phone' => '09171234567',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $payment = Payment::create([
            'reference' => 'BRANCH-CUSTOMER-PAYMENT',
            'provider' => 'sandbox',
            'amount' => 263,
            'status' => 'paid',
            'metadata' => ['franchise_id' => $branch->id],
        ]);
        $login = $this->postJson('/api/login', [
            'email' => $customer->email,
            'password' => 'password123',
        ])->assertOk();
        $payload = [
            'email' => $customer->email,
            'franchise_id' => $branch->id,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => 1,
                'quantity' => 1,
            ]],
            'total' => 1,
            'delivery_address' => 'Payment Link St',
            'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
            'payment_method' => 'gcash',
            'payment_reference' => $payment->reference,
            'phone' => $customer->phone,
        ];

        $this->postJson('/api/orders', $payload, [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])
            ->assertCreated()
            ->assertJsonPath('order.franchise_id', $branch->id);
        $orderId = Order::where('payment_reference', $payment->reference)->value('id');
        $this->assertNotNull($orderId);
        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'order_id' => $orderId,
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'franchise_id' => $branch->id,
            'payment_reference' => $payment->reference,
        ]);
    }

    public function test_customer_cannot_apply_payment_created_for_another_franchise(): void
    {
        $branch = Franchise::create([
            'name' => 'Payment Target Branch',
            'email' => 'payment-target@example.com',
            'phone' => '09170000009',
            'address' => 'Target St',
            'status' => 'active',
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Payment Origin Branch',
            'email' => 'payment-origin@example.com',
            'phone' => '09170000010',
            'address' => 'Origin St',
            'status' => 'active',
        ]);
        $product = Product::create([
            'name' => 'Payment Target Meal',
            'description' => 'Branch payment scope test',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $payment = Payment::create([
            'reference' => 'WRONG-BRANCH-PAYMENT',
            'provider' => 'sandbox',
            'amount' => 263,
            'status' => 'paid',
            'metadata' => ['franchise_id' => $otherBranch->id],
        ]);
        $customer = User::create([
            'full_name' => 'Payment Scope Customer',
            'email' => 'payment-scope-customer@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $login = $this->postJson('/api/login', [
            'email' => $customer->email,
            'password' => 'password123',
        ])->assertOk();

        $this->postJson('/api/orders', [
            'email' => $customer->email,
            'franchise_id' => $branch->id,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => 199,
                'quantity' => 1,
            ]],
            'delivery_address' => 'Target St',
            'payment_method' => 'gcash',
            'payment_reference' => $payment->reference,
            'phone' => '09171234568',
        ], [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])->assertUnprocessable();

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'order_id' => null,
        ]);
        $this->assertDatabaseMissing('orders', ['payment_reference' => $payment->reference]);
    }

    public function test_customer_branch_gateway_payment_is_bound_to_selected_branch_catalog(): void
    {
        $branch = Franchise::create([
            'name' => 'Gateway Branch',
            'email' => 'gateway-branch@example.com',
            'phone' => '09170000011',
            'address' => 'Gateway St',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 10,
        ]);
        $otherBranch = Franchise::create([
            'name' => 'Other Gateway Branch',
            'email' => 'other-gateway-branch@example.com',
            'phone' => '09170000012',
            'address' => 'Other Gateway St',
            'status' => 'active',
        ]);
        $product = Product::create([
            'name' => 'Gateway Branch Meal',
            'description' => 'Branch checkout payment test',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $branch->id,
            'is_available' => true,
        ]);
        $otherProduct = Product::create([
            'name' => 'Other Gateway Meal',
            'description' => 'Must not be chargeable for another branch',
            'price' => 199,
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => $otherBranch->id,
            'is_available' => true,
        ]);

        $response = $this->postJson('/api/payment/gcash/create', [
            'amount' => 263,
            'franchise_id' => $branch->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'delivery_type' => 'standard',
            'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
            'voucher_discount' => 0,
            'discount_rate' => 0,
        ])->assertCreated();

        $payment = Payment::where('reference', $response->json('reference'))->firstOrFail();
        $this->assertSame($branch->id, data_get($payment->metadata, 'franchise_id'));

        $this->postJson('/api/payment/gcash/create', [
            'amount' => 263,
            'franchise_id' => $branch->id,
            'items' => [['product_id' => $otherProduct->id, 'quantity' => 1]],
            'delivery_type' => 'standard',
            'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
            'voucher_discount' => 0,
            'discount_rate' => 0,
        ])->assertUnprocessable();
    }

    public function test_customer_can_place_a_scheduled_order(): void
    {
        $user = User::create([
            'full_name' => 'Scheduled Customer',
            'email' => 'scheduled@example.com',
            'phone' => '09176543210',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        Franchise::create([
            'name' => 'Scheduled Order Test Branch',
            'status' => 'active',
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 15,
        ]);

        $product = Product::create([
            'name' => 'Original Chicken',
            'description' => 'Classic Korean fried chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'original-chicken.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $scheduledFor = now('Asia/Manila')->addDay()->setTime(15, 0);
        $response = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Block 2, Lot 5, Dasmarinas, Cavite',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'delivery_type' => 'scheduled',
                'phone' => '09176543210',
                'scheduled_at' => $scheduledFor->toISOString(),
                'scheduled_date' => $scheduledFor->format('Y-m-d'),
                'scheduled_time' => '3:00 PM',
                'schedule_display' => $scheduledFor->format('M j, Y').' at 3:00 PM',
                'schedule_window' => '3:00 PM',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.delivery_type', 'scheduled')
            ->assertJsonPath('order.scheduled_date', $scheduledFor->format('Y-m-d'))
            ->assertJsonPath('order.scheduled_time', '3:00 PM')
            ->assertJsonPath('order.scheduled_at', $scheduledFor->copy()->utc()->format('Y-m-d\TH:i:s.u\Z'));
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'scheduled_at' => $scheduledFor->copy()->utc()->format('Y-m-d H:i:s'),
            'scheduled_for' => $scheduledFor->copy()->utc()->format('Y-m-d H:i:s'),
        ]);
    }

    public function test_scheduled_orders_require_a_valid_future_datetime(): void
    {
        $user = User::create([
            'full_name' => 'Past Schedule Customer',
            'email' => 'past-schedule@example.com',
            'phone' => '09170000001',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $product = Product::create([
            'name' => 'Scheduled Chicken',
            'description' => 'Demo scheduled order',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'scheduled-chicken.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Block 2, Lot 5, Dasmarinas, Cavite',
                'payment_method' => 'cash_on_delivery',
                'delivery_type' => 'scheduled',
                'phone' => '09170000001',
                'scheduled_at' => now()->subDay()->toISOString(),
                'scheduled_date' => now()->subDay()->format('Y-m-d'),
                'scheduled_time' => '6:30 PM',
            ]);

        $response
            ->assertStatus(422)
            ->assertJsonPath('errors.scheduled_at.0', fn ($message) => is_string($message) && str_contains($message, 'future'));
    }

    public function test_customer_can_place_a_priority_order(): void
    {
        $this->createOnlineDeliveryBranch('Priority Order Branch');
        $user = User::create([
            'full_name' => 'Priority Customer',
            'email' => 'priority@example.com',
            'phone' => '09177654321',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $product = Product::create([
            'name' => 'Priority Chicken',
            'description' => 'Classic Korean fried chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'priority-chicken.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Block 3, Lot 6, Dasmarinas, Cavite',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'delivery_type' => 'priority',
                'phone' => '09177654321',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.delivery_type', 'priority');
    }

    public function test_admin_order_list_includes_pending_orders_after_the_grace_window(): void
    {
        $this->createOnlineDeliveryBranch('Grace Window Branch');
        $user = User::create([
            'full_name' => 'Grace Window Customer',
            'email' => 'grace@example.com',
            'phone' => '09178889999',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $product = Product::create([
            'name' => 'Grace Window Chicken',
            'description' => 'Classic Korean fried chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'grace-window-chicken.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $orderResponse = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'total' => 0,
                'delivery_address' => 'Block 4, Lot 7, Dasmarinas, Cavite',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => '09178889999',
            ]);

        $order = Order::findOrFail($orderResponse->json('order.id'));
        $order->update(['created_at' => now()->subMinutes(2)]);

        $this->getJson('/api/orders/user')
            ->assertOk()
            ->assertJsonFragment(['id' => $order->id]);
    }

    public function test_order_cancellation_is_rejected_after_the_backend_window_closes(): void
    {
        $this->createOnlineDeliveryBranch('Late Cancellation Branch');
        $user = User::create([
            'full_name' => 'Late Cancellation Customer',
            'email' => 'cancel@example.com',
            'phone' => '09171239999',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $product = Product::create([
            'name' => 'Late Cancellation Chicken',
            'description' => 'Classic Korean fried chicken',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'late-cancel.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $orderResponse = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->postJson('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'delivery_address' => 'Sampaloc, Dasmarinas',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171239999',
            ]);

        $order = Order::findOrFail($orderResponse->json('order.id'));
        Order::whereKey($order->id)->update(['created_at' => now()->subMinute()->subSeconds(1)]);
        $order->refresh();

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->patchJson('/api/orders/'.$order->id.'/status', ['status' => 'cancelled']);

        $response
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cancellation period has ended.');
    }

    public function test_discount_application_decision_sends_email_to_customer(): void
    {
        Notification::fake();

        $user = User::create([
            'full_name' => 'Approved Customer',
            'email' => 'approved.customer@example.com',
            'phone' => '09171234569',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $application = DiscountApplication::create([
            'user_id' => $user->id,
            'discount_type' => 'PWD',
            'full_name' => $user->full_name,
            'id_number' => 'PWD-12345',
            'expiry_date' => now()->addMonths(6),
            'proof_image_url' => 'https://example.com/proof.jpg',
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $adminLogin = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$adminLogin->json('token'))
            ->patchJson('/api/admin/discount-applications/'.$application->id, ['action' => 'approve'])
            ->assertOk();

        Notification::assertSentTo($user, DiscountApplicationDecisionNotification::class, function ($notification) {
            return str_contains(strtolower($notification->status), 'approved');
        });
    }

    public function test_customer_discount_application_proof_is_persisted_in_the_database(): void
    {
        $user = User::create([
            'full_name' => 'Proof Customer',
            'email' => 'proof.customer@example.com',
            'phone' => '09171234569',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);
        $proofFile = UploadedFile::fake()->create('pwd-proof.jpg', 10, 'image/jpeg');

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->post('/api/discount/applications', [
                'discount_type' => 'PWD',
                'id_number' => 'PWD-12345',
                'proof_image' => $proofFile,
            ]);

        $response->assertCreated();
        $application = DiscountApplication::findOrFail($response->json('application.id'));
        $this->assertStringStartsWith('data:image/', $application->getRawOriginal('proof_image_data'));
        $this->assertStringContainsString('/api/discount-applications/'.$application->id.'/proof-image', $application->proof_image_url);

        $imageResponse = $this->get('/api/discount-applications/'.$application->id.'/proof-image');
        $imageResponse->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame(
            base64_decode(substr($application->getRawOriginal('proof_image_data'), strpos($application->getRawOriginal('proof_image_data'), ',') + 1), true),
            $imageResponse->getContent(),
        );
    }

    public function test_delivery_proof_is_persisted_in_the_order_database_record(): void
    {
        $driver = Driver::create([
            'name' => 'Proof Driver',
            'email' => 'proof.driver@example.com',
            'password' => Hash::make('password123'),
            'phone' => '09171234569',
            'vehicleType' => 'motorcycle',
            'isActive' => true,
        ]);
        $driverToken = 'test-driver-token';
        $driver->forceFill(['api_token' => hash('sha256', $driverToken)])->save();

        $order = Order::create([
            'email' => 'delivery.customer@example.com',
            'total' => 263,
            'status' => 'delivered',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Delivery proof test address',
            'phone' => '09171234568',
            'items' => [],
            'driver_id' => $driver->id,
        ]);
        $proofFile = UploadedFile::fake()->create('delivery-proof.jpg', 10, 'image/jpeg');

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$driverToken)
            ->post('/api/driver/orders/'.$order->id.'/delivery-proof', [
                'proof_image' => $proofFile,
            ]);

        $response->assertOk();
        $order->refresh();
        $imageData = $order->getRawOriginal('delivery_proof_image_data');
        $this->assertStringStartsWith('data:image/', $imageData);
        $this->assertSame($response->json('delivery_proof_image_url'), $order->delivery_proof_image);

        $imageResponse = $this->get('/api/orders/'.$order->id.'/delivery-proof');
        $imageResponse->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame(
            base64_decode(substr($imageData, strpos($imageData, ',') + 1), true),
            $imageResponse->getContent(),
        );
    }

    public function test_delivery_proof_submission_can_mark_an_active_order_delivered_atomically(): void
    {
        $driver = Driver::create([
            'name' => 'Completing Driver',
            'email' => 'completing.driver@example.com',
            'password' => Hash::make('password123'),
            'phone' => '09171234569',
            'vehicleType' => 'motorcycle',
            'isActive' => true,
        ]);
        $driverToken = 'test-completing-driver-token';
        $driver->forceFill(['api_token' => hash('sha256', $driverToken)])->save();

        $order = Order::create([
            'email' => 'delivery.customer@example.com',
            'total' => 263,
            'status' => 'on_the_way',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Delivery completion test address',
            'phone' => '09171234568',
            'items' => [],
            'driver_id' => $driver->id,
        ]);

        $response = $this
            ->withHeader('Authorization', 'Bearer '.$driverToken)
            ->post('/api/driver/orders/'.$order->id.'/delivery-proof', [
                'proof_image' => UploadedFile::fake()->create('delivery-proof.jpg', 10, 'image/jpeg'),
                'status' => 'delivered',
            ]);

        $response->assertOk()->assertJsonPath('status', 'delivered');
        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->delivery_confirmed_at);
        $this->assertNotNull($order->fresh()->getRawOriginal('delivery_proof_image_data'));
    }

    public function test_order_list_projection_skips_proof_image_payloads_but_keeps_image_urls(): void
    {
        $order = Order::create([
            'email' => 'proof.list@example.com',
            'total' => 263,
            'status' => 'delivered',
            'payment_method' => 'cash_on_delivery',
            'delivery_address' => 'Delivery proof list test address',
            'phone' => '09171234568',
            'items' => [],
            'delivery_proof_image_data' => 'data:image/jpeg;base64,ZGVsaXZlcnk=',
            'discount_proof_image_data' => 'data:image/jpeg;base64,ZGlzY291bnQ=',
        ]);

        $listedOrder = Order::query()->withoutProofImagePayload()->findOrFail($order->id);

        $this->assertArrayNotHasKey('delivery_proof_image_data', $listedOrder->getAttributes());
        $this->assertArrayNotHasKey('discount_proof_image_data', $listedOrder->getAttributes());
        $this->assertStringContainsString('/api/orders/'.$order->id.'/delivery-proof', $listedOrder->delivery_proof_image);
        $this->assertStringContainsString('/api/orders/'.$order->id.'/discount-proof', $listedOrder->discount_proof_image);
        $this->assertArrayNotHasKey('has_delivery_proof_image_data', $listedOrder->toArray());
        $this->assertArrayNotHasKey('has_discount_proof_image_data', $listedOrder->toArray());
    }

    public function test_discount_verification_request_can_be_created_and_approved_by_admin(): void
    {
        $this->createOnlineDeliveryBranch('Discount Verification Branch');
        $user = User::create([
            'full_name' => 'PWD Customer',
            'email' => 'pwd@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);

        $product = Product::create([
            'name' => 'PWD Chicken',
            'description' => 'Test discount verification order',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'pwd-chicken.jpg',
            'is_available' => true,
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $adminLogin = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $orderResponse = $this
            ->withHeader('Authorization', 'Bearer '.$loginResponse->json('token'))
            ->post('/api/orders', [
                'email' => $user->email,
                'items' => [[
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_price' => 199,
                    'quantity' => 1,
                ]],
                'delivery_address' => 'Block 10, Lot 2, Dasmarinas, Cavite',
                'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171234568',
                'discount_type' => 'PWD',
                'discount_proof_image' => UploadedFile::fake()->create('pwd-id.jpg', 10, 'image/jpeg'),
            ]);

        $orderResponse
            ->assertCreated()
            ->assertJsonPath('order.discount_type', 'PWD')
            ->assertJsonPath('order.discount_status', 'pending');
        $this->assertSame(53.0, (float) $orderResponse->json('order.discount_amount'));

        $requestId = $orderResponse->json('discount_request.id');
        $this->assertNotNull($requestId);
        $discountRequest = DiscountVerificationRequest::findOrFail($requestId);
        $this->assertStringStartsWith('data:image/', $discountRequest->getRawOriginal('proof_image_data'));
        $this->assertSame(
            $discountRequest->getRawOriginal('proof_image_data'),
            Order::findOrFail($orderResponse->json('order.id'))->getRawOriginal('discount_proof_image_data'),
        );
        $discountImageResponse = $this->get('/api/discount-verifications/'.$requestId.'/proof-image');
        $discountImageResponse->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame(
            base64_decode(substr($discountRequest->getRawOriginal('proof_image_data'), strpos($discountRequest->getRawOriginal('proof_image_data'), ',') + 1), true),
            $discountImageResponse->getContent(),
        );

        $reviewResponse = $this
            ->withHeader('Authorization', 'Bearer '.$adminLogin->json('token'))
            ->patchJson('/api/admin/discount-verifications/'.$requestId, [
                'action' => 'approve',
            ]);

        $reviewResponse
            ->assertOk()
            ->assertJsonPath('request.status', 'approved');

        $order = Order::findOrFail($orderResponse->json('order.id'));
        $this->assertSame('approved', $order->discount_status);
        $this->assertSame('PWD', $order->discount_type);
        $this->assertGreaterThan(0, (float) $order->discount_amount);
    }

    public function test_admin_approved_discount_is_applied_without_another_proof_upload(): void
    {
        $this->createOnlineDeliveryBranch('Approved Discount Branch');
        $user = User::create([
            'full_name' => 'Approved PWD Customer',
            'email' => 'approved-pwd@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        DiscountApplication::create([
            'user_id' => $user->id,
            'discount_type' => 'PWD',
            'full_name' => $user->full_name,
            'id_number' => 'PWD-12345',
            'expiry_date' => now()->addMonths(6)->toDateString(),
            'status' => 'approved',
            'submitted_at' => now()->subDay(),
            'reviewed_at' => now(),
        ]);
        $product = Product::create([
            'name' => 'Approved discount chicken',
            'description' => 'Test approved discount checkout',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'approved-discount-chicken.jpg',
            'is_available' => true,
        ]);

        $this->actingAs($user, 'api')->postJson('/api/orders', [
            'email' => $user->email,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => 199,
                'quantity' => 1,
            ]],
            'delivery_address' => 'Block 10, Lot 2, Dasmarinas, Cavite',
            'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
            'payment_method' => 'cash_on_delivery',
            'phone' => '09171234568',
            'discount_type' => 'PWD',
        ])->assertCreated()
            ->assertJsonPath('order.discount_type', 'PWD')
            ->assertJsonPath('order.discount_status', 'approved')
            ->assertJsonPath('discount_request', null);

        $order = Order::query()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame(0.2, (float) $order->discount_rate);
        $this->assertSame(53.0, (float) $order->discount_amount);
        $this->assertNull($order->getRawOriginal('discount_proof_image_data'));
        $this->assertDatabaseCount('discount_verification_requests', 0);
    }

    public function test_order_discount_without_an_approved_application_still_requires_proof(): void
    {
        $this->createOnlineDeliveryBranch('Pending Discount Branch');
        $user = User::create([
            'full_name' => 'Pending PWD Customer',
            'email' => 'pending-pwd@example.com',
            'phone' => '09171234568',
            'password' => Hash::make('password123'),
            'role' => 'customer',
            'email_verified_at' => now(),
        ]);
        $product = Product::create([
            'name' => 'Pending discount chicken',
            'description' => 'Test proof requirement',
            'price' => 199,
            'category' => 'chicken',
            'image' => 'pending-discount-chicken.jpg',
            'is_available' => true,
        ]);

        $this->actingAs($user, 'api')->postJson('/api/orders', [
            'email' => $user->email,
            'items' => [[
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => 199,
                'quantity' => 1,
            ]],
            'delivery_address' => 'Block 10, Lot 2, Dasmarinas, Cavite',
            'delivery_coordinates' => ['lat' => 14.3194, 'lng' => 120.9943],
            'payment_method' => 'cash_on_delivery',
            'phone' => '09171234568',
            'discount_type' => 'PWD',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['proof_image']);
    }

    private function createOnlineDeliveryBranch(string $name): Franchise
    {
        return Franchise::create([
            'name' => $name,
            'status' => 'active',
            'is_active' => true,
            'latitude' => 14.3194,
            'longitude' => 120.9943,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => 10,
        ]);
    }
}
