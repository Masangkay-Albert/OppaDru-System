<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_demo_admin_can_login_when_no_admin_row_exists(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $response->assertOk();
        $response->assertJsonPath('admin.email', 'admin@oppadru.com');
        $response->assertJsonStructure(['token', 'admin']);
    }

    public function test_admin_can_delete_an_addon_group(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $token = $login->json('token');

        $group = \App\Models\AddonGroup::create([
            'name' => 'Delete Me Group',
            'selection_type' => 'multiple',
            'supports_quantity' => false,
            'applicable_categories' => ['rice'],
            'is_active' => true,
        ]);

        $response = $this->deleteJson('/api/admin/addon-groups/' . $group->id, [], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertOk();
        $this->assertDatabaseMissing('addon_groups', ['id' => $group->id]);
    }

    public function test_admin_can_create_addon_with_long_image_url(): void
    {
        $login = $this->postJson('/api/admin/login', [
            'email' => 'admin@oppadru.com',
            'password' => 'Admin@123',
        ]);

        $token = $login->json('token');

        $group = \App\Models\AddonGroup::create([
            'name' => 'Long Image Group',
            'selection_type' => 'multiple',
            'supports_quantity' => false,
            'applicable_categories' => ['rice'],
            'is_active' => true,
        ]);

        $longImageUrl = 'https://example.com/storage/v1/object/public/addons/' . str_repeat('a', 500) . '.png';

        $response = $this->postJson('/api/admin/addon-groups/' . $group->id . '/addons', [
            'name' => 'Long URL Add-on',
            'price' => 45,
            'image' => $longImageUrl,
            'is_active' => true,
        ], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('addons', ['name' => 'Long URL Add-on', 'addon_group_id' => $group->id]);
        $this->assertNotSame('', \App\Models\Addon::where('name', 'Long URL Add-on')->value('image'));
    }
}
