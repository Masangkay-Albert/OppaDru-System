<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Product;
use App\Models\Promo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PromoRedemptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_validation_uses_server_prices_and_returns_only_the_submitted_promo_result(): void
    {
        $product = Product::create([
            'name' => 'Chicken meal',
            'description' => 'Meal',
            'price' => 120,
            'category' => 'chicken',
            'image' => 'chicken.jpg',
            'is_available' => true,
        ]);
        Promo::create([
            'code' => 'SERVERPRICE',
            'title' => 'Private promo title',
            'channel' => 'online',
            'discount_type' => 'percent',
            'discount_value' => 25,
            'is_active' => true,
        ]);

        $this->postJson('/api/promos/validate', [
            'code' => ' server price ',
            'items' => [[
                'product_id' => $product->id,
                'product_price' => 0.01,
                'quantity' => 2,
            ]],
        ], $this->customerHeaders())
            ->assertOk()
            ->assertJsonPath('isValid', true)
            ->assertJsonPath('discount', 60)
            ->assertJsonPath('code', 'SERVERPRICE')
            ->assertJsonMissingPath('promo')
            ->assertJsonMissingPath('title');
    }

    public function test_customer_validation_rejects_cashier_only_promos(): void
    {
        $product = Product::create([
            'name' => 'Rice meal',
            'description' => 'Meal',
            'price' => 100,
            'category' => 'rice',
            'image' => 'rice.jpg',
            'is_available' => true,
        ]);
        Promo::create([
            'code' => 'POSONLY',
            'title' => 'POS promo',
            'channel' => 'onsite',
            'discount_type' => 'fixed',
            'discount_value' => 20,
            'is_active' => true,
        ]);

        $this->postJson('/api/promos/validate', [
            'code' => 'POSONLY',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ], $this->customerHeaders())
            ->assertOk()
            ->assertJsonPath('isValid', false)
            ->assertJsonPath('error_code', 'PROMO_INVALID');
    }

    public function test_invalid_promo_attempts_are_rate_limited(): void
    {
        $product = Product::create([
            'name' => 'Noodle meal',
            'description' => 'Meal',
            'price' => 100,
            'category' => 'noodles',
            'image' => 'noodles.jpg',
            'is_available' => true,
        ]);
        $payload = [
            'code' => 'DOESNOTEXIST',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];
        $headers = $this->customerHeaders();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/promos/validate', $payload, $headers)
                ->assertOk()
                ->assertJsonPath('error_code', 'PROMO_INVALID');
        }

        $this->postJson('/api/promos/validate', $payload, $headers)
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'PROMO_RATE_LIMITED');
    }

    private function customerHeaders(): array
    {
        $token = 'promo-redemption-customer-token';
        User::create([
            'full_name' => 'Promo Customer',
            'email' => 'promo-customer@example.com',
            'password' => Hash::make('Password123!'),
            'email_verified_at' => now(),
            'api_token' => hash('sha256', $token),
        ]);

        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_public_announcement_responses_exclude_promo_announcements(): void
    {
        Announcement::create([
            'title' => 'Private promo',
            'content' => 'Hidden promo code OPPA123',
            'target_audience' => 'customers',
            'priority' => 'promo',
            'status' => 'published',
        ]);
        Announcement::create([
            'title' => 'Restaurant update',
            'content' => 'Updated opening hours.',
            'target_audience' => 'customers',
            'priority' => 'normal',
            'status' => 'published',
        ]);

        $this->getJson('/api/announcements?audience=customers')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Restaurant update'])
            ->assertJsonMissing(['title' => 'Private promo'])
            ->assertJsonMissing(['content' => 'Hidden promo code OPPA123']);
    }
}
