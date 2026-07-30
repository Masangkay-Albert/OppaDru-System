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
                'total' => 476.56,
                'delivery_address' => 'Block 1, Lot 2, Dasmarinas, Cavite',
                'payment_method' => 'cash_on_delivery',
                'phone' => '09171234567',
            ]);

        $orderResponse
            ->assertCreated()
            ->assertJsonPath('order.email', $user->email)
            ->assertJsonPath('order.total', '476.56')
            ->assertJsonPath('order.items.0.product_id', $product->id);
    }
}
