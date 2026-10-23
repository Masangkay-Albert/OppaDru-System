<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Franchise;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmployeePosDraftTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_pos_draft_migration_creates_tab_scoped_storage(): void
    {
        $this->assertTrue(Schema::hasTable('employee_pos_drafts'));
        $this->assertTrue(Schema::hasColumns('employee_pos_drafts', [
            'employee_id',
            'franchise_id',
            'browser_session_id',
            'draft_data',
            'created_at',
            'updated_at',
        ]));
    }

    public function test_branch_cashier_can_load_its_tab_scoped_draft_from_supabase(): void
    {
        [$branch, $headers, $employee] = $this->makeCashier('draft-read@example.test');
        config([
            'services.supabase.url' => 'https://oppadru-test.supabase.co',
            'services.supabase.service_role_key' => 'test-service-role-key',
        ]);
        Http::fake([
            'https://oppadru-test.supabase.co/rest/v1/employee_pos_drafts*' => Http::response([
                ['draft_data' => [
                    'cart' => ['product:medium' => ['quantity' => 2]],
                    'favorite_ids' => ['product-id'],
                    'include_cutlery' => true,
                ]],
            ]),
        ]);
        $browserSessionId = 'a5e5a780-6a15-4a20-96a4-6c891df37f3b';

        $this->getJson('/api/employee/pos/draft?browser_session_id='.$browserSessionId, $headers)
            ->assertOk()
            ->assertJsonPath('draft.cart.product:medium.quantity', 2)
            ->assertJsonPath('draft.favorite_ids.0', 'product-id')
            ->assertJsonPath('draft.include_cutlery', true);

        Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://oppadru-test.supabase.co/rest/v1/employee_pos_drafts')
            && $request->hasHeader('apikey', 'test-service-role-key')
            && str_contains($request->url(), 'employee_id=eq.'.$employee->id)
            && str_contains($request->url(), 'browser_session_id=eq.'.$browserSessionId));
        $this->assertNotNull($branch->id);
    }

    public function test_branch_cashier_can_save_a_valid_draft_through_the_server_side_supabase_key(): void
    {
        [$branch, $headers, $employee] = $this->makeCashier('draft-save@example.test');
        config([
            'services.supabase.url' => 'https://oppadru-test.supabase.co',
            'services.supabase.service_role_key' => 'test-service-role-key',
        ]);
        Http::fake([
            'https://oppadru-test.supabase.co/rest/v1/employee_pos_drafts*' => Http::response([
                ['draft_data' => [
                    'cart' => ['product:large' => ['quantity' => 1]],
                    'favorite_ids' => ['product-id'],
                    'include_cutlery' => false,
                ]],
            ]),
        ]);
        $browserSessionId = 'f2275287-eedc-47fe-a46c-508c5f0b85e6';

        $this->putJson('/api/employee/pos/draft', [
            'browser_session_id' => $browserSessionId,
            'cart' => ['product:large' => ['quantity' => 1]],
            'favorite_ids' => ['product-id'],
            'include_cutlery' => false,
        ], $headers)
            ->assertOk()
            ->assertJsonPath('draft.cart.product:large.quantity', 1);

        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->hasHeader('Authorization', 'Bearer test-service-role-key')
            && $request['employee_id'] === $employee->id
            && $request['franchise_id'] === $branch->id
            && $request['browser_session_id'] === $browserSessionId
            && $request['draft_data']['favorite_ids'] === ['product-id']);
    }

    public function test_employee_pos_draft_requires_a_valid_session_id_and_supabase_configuration(): void
    {
        [, $headers] = $this->makeCashier('draft-invalid@example.test');
        config([
            'services.supabase.url' => null,
            'services.supabase.service_role_key' => null,
        ]);

        $this->getJson('/api/employee/pos/draft', $headers)
            ->assertBadRequest()
            ->assertJsonPath('success', false);

        $this->getJson('/api/employee/pos/draft?browser_session_id=a5e5a780-6a15-4a20-96a4-6c891df37f3b', $headers)
            ->assertStatus(503)
            ->assertJsonPath('success', false);
    }

    private function makeCashier(string $email): array
    {
        $branch = Franchise::create(['name' => 'POS Draft Branch', 'status' => 'active']);
        $employee = Employee::create([
            'franchise_id' => $branch->id,
            'fullName' => 'POS Draft Cashier',
            'email' => $email,
            'password' => Hash::make('Cashier@123'),
            'position' => 'cashier',
            'is_active' => true,
        ]);
        $token = 'employee-pos-draft-token';
        $employee->api_token = hash('sha256', $token);
        $employee->save();

        return [
            $branch,
            ['Authorization' => 'Bearer '.$token],
            $employee,
        ];
    }
}
