<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Promo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromoUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_promo_with_unchanged_numeric_values(): void
    {
        $token = 'test-admin-token';
        Admin::create([
            'full_name' => 'Promo Admin',
            'email' => 'promo-admin@example.com',
            'password' => 'password',
            'api_token' => hash('sha256', $token),
        ]);
        $promo = Promo::create([
            'title' => 'Original promo',
            'code' => 'SAVE200',
            'discount_type' => 'fixed',
            'discount_value' => '200.00',
            'min_order_amount' => '0.00',
            'max_discount_amount' => '300.00',
            'usage_limit' => 100,
            'per_customer_limit' => 2,
            'is_active' => true,
        ]);

        $this->withToken($token)->putJson('/api/admin/promos/'.$promo->id, [
            'title' => 'Updated promo',
            'discount_type' => 'fixed',
            'discount_value' => '200.00',
            'min_order_amount' => '0',
            'max_discount_amount' => '300',
            'usage_limit' => '100',
            'per_customer_limit' => '2',
            'is_active' => '1',
        ])->assertOk()
            ->assertJsonPath('promo.title', 'Updated promo')
            ->assertJsonPath('promo.discount_value', 200)
            ->assertJsonPath('promo.min_order_amount', 0)
            ->assertJsonPath('promo.max_discount_amount', 300);
    }
}
