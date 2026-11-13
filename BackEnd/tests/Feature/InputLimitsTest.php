<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Admin;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InputLimitsTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        Admin::create([
            'full_name' => 'Input Limits Admin',
            'email' => 'input-limits-admin@example.test',
            'password' => Hash::make('Password123'),
            'api_token' => hash('sha256', 'input-limits-token'),
            'role' => Admin::ROLE_ADMIN,
        ]);

        return ['Authorization' => 'Bearer input-limits-token'];
    }

    public function test_new_products_enforce_name_description_and_amount_limits(): void
    {
        $headers = $this->adminHeaders();
        $this->postJson('/api/admin/products', [
            'name' => str_repeat('P', 50),
            'description' => str_repeat('D', 120),
            'price' => '999999.99',
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
            'franchise_id' => null,
        ], $headers)->assertCreated();

        $this->postJson('/api/admin/products', [
            'name' => str_repeat('P', 51),
            'description' => str_repeat('D', 121),
            'price' => '1000000.00',
            'category' => 'chicken',
            'image' => '',
            'franchise_id' => null,
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'description', 'price']);
    }

    public function test_unchanged_legacy_product_and_addon_values_remain_editable(): void
    {
        $headers = $this->adminHeaders();
        $product = Product::create([
            'name' => str_repeat('Legacy product ', 5),
            'description' => str_repeat('Legacy description ', 10),
            'price' => '1000000.00',
            'category' => 'chicken',
            'image' => '',
            'is_available' => true,
        ]);
        $this->putJson("/api/admin/products/{$product->id}", [
            'name' => $product->name,
            'description' => $product->description,
            'price' => $product->price,
            'category' => 'snacks',
        ], $headers)->assertOk();
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => $product->name,
            'description' => $product->description,
            'price' => '1000000.00',
            'category' => 'snacks',
        ]);

        $group = AddonGroup::create([
            'name' => 'Legacy group',
            'selection_type' => 'multiple',
            'supports_quantity' => false,
            'applicable_categories' => ['chicken'],
            'is_active' => true,
        ]);
        $addon = Addon::create([
            'addon_group_id' => $group->id,
            'name' => str_repeat('Legacy add-on ', 5),
            'price' => '1000000.00',
            'is_active' => true,
            'image' => '',
        ]);

        $this->putJson("/api/admin/addons/{$addon->id}", [
            'name' => $addon->name,
            'price' => $addon->price,
            'is_active' => false,
        ], $headers)->assertOk();
        $this->assertDatabaseHas('addons', [
            'id' => $addon->id,
            'name' => $addon->name,
            'price' => '1000000.00',
            'is_active' => false,
        ]);
    }

    public function test_announcement_and_promo_limits_accept_boundaries_and_reject_overages(): void
    {
        $headers = $this->adminHeaders();
        $this->postJson('/api/admin/announcements', [
            'title' => str_repeat('T', 80),
            'content' => str_repeat('C', 1000),
            'target_audience' => 'customers',
            'status' => 'draft',
            'publish_to_facebook' => false,
        ], $headers)->assertCreated();
        $this->postJson('/api/admin/announcements', [
            'title' => str_repeat('T', 81),
            'content' => str_repeat('C', 1001),
            'status' => 'draft',
            'publish_to_facebook' => false,
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'content']);

        $this->postJson('/api/admin/promos', [
            'title' => str_repeat('P', 80),
            'code' => str_repeat('A', 20),
            'description' => str_repeat('D', 255),
            'discount_type' => 'percent',
            'discount_value' => '100.00',
            'min_order_amount' => '999999.99',
            'usage_limit' => 999999,
        ], $headers)->assertCreated();
        $this->postJson('/api/admin/promos', [
            'title' => str_repeat('P', 81),
            'code' => str_repeat('A', 21),
            'description' => str_repeat('D', 256),
            'discount_type' => 'percent',
            'discount_value' => '100.01',
            'min_order_amount' => '1000000.00',
            'usage_limit' => 1000000,
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'code', 'description', 'discount_value', 'min_order_amount', 'usage_limit']);
    }

    public function test_customer_profile_limits_preserve_unchanged_legacy_values_and_bound_new_passwords(): void
    {
        $legacyName = str_repeat('Legacy Customer ', 5);
        $user = User::create([
            'full_name' => $legacyName,
            'email' => 'legacy-customer@example.test',
            'phone' => 'legacy-phone-value',
            'password' => Hash::make('LegacyPassword123!'),
            'role' => 'customer',
            'email_verified_at' => now(),
            'api_token' => hash('sha256', 'profile-token'),
        ]);
        $headers = ['Authorization' => 'Bearer profile-token'];

        $this->putJson('/api/user/profile', [
            'full_name' => $legacyName,
            'phone' => 'legacy-phone-value',
        ], $headers)->assertOk();
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'full_name' => $legacyName,
            'phone' => 'legacy-phone-value',
        ]);

        $this->putJson('/api/user/profile', [
            'full_name' => str_repeat('N', 61),
            'phone' => '09171234567',
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors('full_name');
        $this->putJson('/api/user/profile', [
            'full_name' => $legacyName,
            'phone' => '0917123456789',
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors('phone');

        $this->postJson('/api/change-password', [
            'current_password' => 'LegacyPassword123!',
            'new_password' => str_repeat('P', 65),
            'new_password_confirmation' => str_repeat('P', 65),
        ], $headers)->assertUnprocessable()
            ->assertJsonValidationErrors('new_password');
    }

    public function test_customer_registration_rejects_emails_longer_than_the_form_limit(): void
    {
        $email = str_repeat('a', 39).'@example.test';
        $this->assertSame(52, strlen($email));

        $this->postJson('/api/register', [
            'full_name' => 'Valid Customer',
            'email' => $email,
            'phone' => '09171234567',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    public function test_new_customer_registration_requires_a_valid_phone_and_normalizes_plus63(): void
    {
        $basePayload = [
            'full_name' => 'Valid Customer',
            'email' => 'phone-required@example.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ];

        $this->postJson('/api/register', $basePayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');

        $this->postJson('/api/register', [
            ...$basePayload,
            'email' => 'phone-invalid@example.test',
            'phone' => '0917123456A',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('phone');

        $this->postJson('/api/register', [
            ...$basePayload,
            'phone' => '+639171234567',
        ])->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'email' => 'phone-required@example.test',
            'phone' => '09171234567',
        ]);
    }
}
