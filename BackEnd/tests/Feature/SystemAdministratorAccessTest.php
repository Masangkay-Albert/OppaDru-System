<?php

namespace Tests\Feature;

use App\Models\Admin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SystemAdministratorAccessTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(string $email, string $role, string $token): Admin
    {
        return Admin::create([
            'full_name' => ucfirst(strstr($email, '@', true) ?: 'Admin'),
            'email' => $email,
            'password' => Hash::make('Password123'),
            'api_token' => hash('sha256', $token),
            'role' => $role,
        ]);
    }

    public function test_regular_admin_cannot_access_admin_account_management_endpoints(): void
    {
        $regularAdmin = $this->createAdmin('regular@example.com', Admin::ROLE_ADMIN, 'regular-token');
        $headers = ['Authorization' => 'Bearer regular-token'];

        $this->getJson('/api/admin/list', $headers)->assertForbidden();
        $this->postJson('/api/admin/register', [
            'full_name' => 'Blocked Admin',
            'email' => 'blocked@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ], $headers)->assertForbidden();
        $this->putJson('/api/admin/admins/'.$regularAdmin->id, [
            'full_name' => 'Changed Name',
            'email' => $regularAdmin->email,
        ], $headers)->assertForbidden();
        $this->patchJson('/api/admin/admins/'.$regularAdmin->id.'/role', [
            'role' => Admin::ROLE_SYSTEM_ADMINISTRATOR,
        ], $headers)->assertForbidden();
        $this->putJson('/api/admin/admins/'.$regularAdmin->id.'/reset-password', [
            'password' => 'NewPassword123',
            'password_confirmation' => 'NewPassword123',
        ], $headers)->assertForbidden();
        $this->deleteJson('/api/admin/admins/'.$regularAdmin->id, [], $headers)->assertForbidden();

        $this->getJson('/api/admin/count', $headers)->assertOk();
    }

    public function test_system_administrator_can_list_and_create_admins(): void
    {
        $systemAdmin = $this->createAdmin('system@example.com', Admin::ROLE_SYSTEM_ADMINISTRATOR, 'system-token');
        $headers = ['Authorization' => 'Bearer system-token'];

        $this->getJson('/api/admin/list', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.role', Admin::ROLE_SYSTEM_ADMINISTRATOR);

        $this->postJson('/api/admin/register', [
            'full_name' => 'New Admin',
            'email' => 'new-admin@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'role' => Admin::ROLE_ADMIN,
        ], $headers)->assertCreated()->assertJsonPath('admin.role', Admin::ROLE_ADMIN);

        $this->assertDatabaseHas('admin', [
            'id' => $systemAdmin->id,
            'role' => Admin::ROLE_SYSTEM_ADMINISTRATOR,
        ]);
    }

    public function test_system_administrator_can_edit_change_role_reset_password_and_delete_an_admin(): void
    {
        $systemAdmin = Admin::where('email', 'admin@oppadru.com')->firstOrFail();
        $systemAdmin->api_token = hash('sha256', 'system-token');
        $systemAdmin->save();
        $regularAdmin = $this->createAdmin('managed@example.com', Admin::ROLE_ADMIN, 'managed-token');
        $systemHeaders = ['Authorization' => 'Bearer system-token'];
        $regularHeaders = ['Authorization' => 'Bearer managed-token'];

        $this->putJson('/api/admin/admins/'.$regularAdmin->id, [
            'full_name' => 'Managed Administrator',
            'email' => 'managed@example.com',
        ], $systemHeaders)->assertOk()->assertJsonPath('admin.full_name', 'Managed Administrator');

        $this->patchJson('/api/admin/admins/'.$regularAdmin->id.'/role', [
            'role' => Admin::ROLE_SYSTEM_ADMINISTRATOR,
        ], $systemHeaders)->assertOk()->assertJsonPath('admin.role', Admin::ROLE_SYSTEM_ADMINISTRATOR);
        $this->patchJson('/api/admin/admins/'.$regularAdmin->id.'/role', [
            'role' => Admin::ROLE_ADMIN,
        ], $systemHeaders)->assertOk()->assertJsonPath('admin.role', Admin::ROLE_ADMIN);

        $this->getJson('/api/admin/list', $regularHeaders)->assertForbidden();

        $this->putJson('/api/admin/admins/'.$regularAdmin->id.'/reset-password', [
            'password' => 'UpdatedPassword123',
            'password_confirmation' => 'UpdatedPassword123',
        ], $systemHeaders)->assertOk();
        $this->assertTrue(Hash::check('UpdatedPassword123', $regularAdmin->fresh()->password));

        $this->deleteJson('/api/admin/admins/'.$regularAdmin->id, [], $systemHeaders)->assertOk();
        $this->assertDatabaseMissing('admin', ['id' => $regularAdmin->id]);
    }

    public function test_last_system_administrator_cannot_be_demoted_or_deleted(): void
    {
        $systemAdmin = Admin::where('email', 'admin@oppadru.com')->firstOrFail();
        $systemAdmin->api_token = hash('sha256', 'system-token');
        $systemAdmin->save();
        $headers = ['Authorization' => 'Bearer system-token'];

        $this->patchJson('/api/admin/admins/'.$systemAdmin->id.'/role', [
            'role' => Admin::ROLE_ADMIN,
        ], $headers)->assertUnprocessable();
        $this->deleteJson('/api/admin/admins/'.$systemAdmin->id, [], $headers)->assertUnprocessable();
        $this->assertDatabaseHas('admin', [
            'id' => $systemAdmin->id,
            'role' => Admin::ROLE_SYSTEM_ADMINISTRATOR,
        ]);
    }

    public function test_system_administrator_cannot_delete_own_account_even_when_another_system_admin_exists(): void
    {
        $firstAdmin = $this->createAdmin('system-one@example.com', Admin::ROLE_SYSTEM_ADMINISTRATOR, 'first-token');
        $this->createAdmin('system-two@example.com', Admin::ROLE_SYSTEM_ADMINISTRATOR, 'second-token');

        $this->deleteJson('/api/admin/admins/'.$firstAdmin->id, [], [
            'Authorization' => 'Bearer first-token',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('admin', ['id' => $firstAdmin->id]);
    }
}
