<?php

namespace Tests\Feature;

use App\Models\DiscountApplication;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Franchise;
use App\Models\FranchiseInventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Notifications\DiscountApplicationDecisionNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderPlacementTest extends TestCase
{
    use RefreshDatabase;

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
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171234567',
            ]);

        $orderResponse
            ->assertCreated()
            ->assertJsonPath('order.email', $user->email)
            ->assertJsonPath('order.total', '462.00')
            ->assertJsonPath('order.delivery_fee', '49.00')
            ->assertJsonPath('order.service_fee', '15.00')
            ->assertJsonPath('order.items.0.product_id', $product->id);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('0.id', $orderResponse->json('order.id'))
            ->assertJsonPath('0.delivery_type', 'standard');
    }

    public function test_cod_order_is_counted_only_after_delivery_and_only_once(): void
    {
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
    }

    public function test_gcash_and_card_amount_validation_accepts_size_and_addon_quantities(): void
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
        $item = [
            'product_id' => $product->id,
            'quantity' => 3,
            'selected_size' => 'Small',
            'selected_addons' => [['id' => $addon->id, 'quantity' => 2]],
        ];
        $pricingPayload = [
            'amount' => 400,
            'items' => [$item],
            'delivery_type' => 'standard',
            'voucher_discount' => 0,
            'discount_rate' => 0,
        ];

        $this->postJson('/api/payment/gcash/create', $pricingPayload)
            ->assertCreated()
            ->assertJsonPath('amount', 400);

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
            ->assertStatus(503)
            ->assertJsonPath('message', 'Card sandbox payments are not configured.');
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
                'payment_method' => 'cash_on_delivery',
                'phone' => $user->phone,
            ]);

        $response->assertCreated();
        $this->assertSame($branch->id, $response->json('order.franchise_id'));
        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'franchise_id' => $branch->id,
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

        $futureDate = now()->addDay()->format('Y-m-d');
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
                'phone' => '09176543210',
                'scheduled_at' => now()->addDay()->setTime(14, 0)->toISOString(),
                'scheduled_date' => $futureDate,
                'scheduled_time' => '2:00 PM - 2:30 PM',
                'schedule_display' => now()->addDay()->setTime(14, 0)->translatedFormat('M j, Y') . ' at 2:00 PM',
                'schedule_window' => '2:00 PM - 2:30 PM',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.delivery_type', 'scheduled')
            ->assertJsonPath('order.scheduled_date', now()->addDay()->format('Y-m-d'))
            ->assertJsonPath('order.scheduled_time', '2:00 PM - 2:30 PM');
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
                'payment_method' => 'cash_on_delivery',
                'phone' => '09178889999',
            ]);

        $order = Order::findOrFail($orderResponse->json('order.id'));
        $order->update(['created_at' => now()->subMinutes(2)]);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonFragment(['id' => $order->id]);
    }

    public function test_order_cancellation_is_rejected_after_the_backend_window_closes(): void
    {
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
            ->assertJsonPath('message', 'Order cancellation is only allowed within 20 seconds of creation.');
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

    public function test_discount_verification_request_can_be_created_and_approved_by_admin(): void
    {
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
}
