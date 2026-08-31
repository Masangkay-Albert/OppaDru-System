<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
            ->assertJsonPath('order.total', '517.44')
            ->assertJsonPath('order.delivery_fee', '49.00')
            ->assertJsonPath('order.service_fee', '15.00')
            ->assertJsonPath('order.items.0.product_id', $product->id);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('0.id', $orderResponse->json('order.id'))
            ->assertJsonPath('0.delivery_type', 'standard');
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
                'scheduled_at' => '2026-09-02T14:00:00+08:00',
                'scheduled_date' => '2026-09-02',
                'scheduled_time' => '2:00 PM - 2:30 PM',
                'schedule_display' => 'Sep 2, 2026 at 2:00 PM',
                'schedule_window' => '2:00 PM - 2:30 PM',
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.delivery_type', 'scheduled')
            ->assertJsonPath('order.scheduled_date', '2026-09-02')
            ->assertJsonPath('order.scheduled_time', '2:00 PM - 2:30 PM');
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
}
