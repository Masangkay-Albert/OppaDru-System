<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FranchiseAccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function adminHeaders(): array
    {
        $token = 'franchise-delete-test-token';
        Admin::create([
            'full_name' => 'Test Admin',
            'email' => 'franchise-delete-admin@example.com',
            'password' => Hash::make('Password123'),
            'api_token' => hash('sha256', $token),
        ]);

        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_admin_can_delete_an_empty_franchise_account(): void
    {
        $headers = $this->adminHeaders();
        $account = FranchiseAccount::create([
            'name' => 'Empty franchise',
            'status' => 'active',
        ]);

        $this->deleteJson('/api/admin/franchise-accounts/'.$account->id, [], $headers)
            ->assertOk()
            ->assertJsonPath('message', 'Franchise account deleted successfully.');

        $this->assertDatabaseMissing('franchise_accounts', ['id' => $account->id]);
    }

    public function test_admin_cannot_delete_a_franchise_account_with_locations(): void
    {
        $headers = $this->adminHeaders();
        $account = FranchiseAccount::create([
            'name' => 'Franchise with location',
            'status' => 'active',
        ]);
        Franchise::create([
            'franchise_account_id' => $account->id,
            'name' => 'Linked location',
            'slug' => 'linked-location',
            'status' => 'active',
        ]);

        $this->deleteJson('/api/admin/franchise-accounts/'.$account->id, [], $headers)
            ->assertStatus(409);

        $this->assertDatabaseHas('franchise_accounts', ['id' => $account->id]);
    }
}
