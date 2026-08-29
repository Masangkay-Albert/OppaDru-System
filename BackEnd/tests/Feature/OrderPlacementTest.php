<?php

namespace Tests\Feature;

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
}
