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
}
