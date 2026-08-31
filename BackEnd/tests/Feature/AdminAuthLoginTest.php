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
}
