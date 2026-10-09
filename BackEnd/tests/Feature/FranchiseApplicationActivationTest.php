<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class FranchiseApplicationActivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_activation_requires_approval_agreement_payment_and_all_applicable_requirements(): void
    {
        $adminToken = $this->createAdminToken();
        $application = $this->createFranchiseApplication();
        $headers = ['Authorization' => 'Bearer '.$adminToken];
        $activationData = $this->activationData();

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', $activationData, $headers)
            ->assertStatus(409);

        $this->advanceToConditionalApproval($application, $headers);
        $incompleteRequirements = $this->requirementsData();
        $incompleteRequirements['required_documents'][0]['status'] = 'received';
        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', $incompleteRequirements, $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'requirements_pending',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'approved_for_opening',
            'next_step_instructions' => 'Opening requirements are complete. Await final activation.',
        ], $headers)->assertStatus(409)
            ->assertJsonPath('requirements.0', 'Required document not verified: Business registration.');

        $this->assertSame(0, Franchise::count());
        $this->assertSame(0, FranchiseAccount::count());
        $this->assertSame(0, FranchiseUser::count());
        $application->forceFill(['status' => 'approved_for_opening'])->save();
        $this->postJson('/api/franchise/login', [
            'email' => 'branch.manager@example.test',
            'password' => 'BranchManagerPass123!',
        ])->assertUnauthorized();
        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', $activationData, $headers)
            ->assertStatus(409)
            ->assertJsonPath('requirements.0', 'Required document not verified: Business registration.');
        $this->assertSame(0, Franchise::count());
    }

    public function test_authorized_activation_creates_one_active_location_and_manager_only_after_all_gates_pass(): void
    {
        $adminToken = $this->createAdminToken();
        $application = $this->createFranchiseApplication();
        $headers = ['Authorization' => 'Bearer '.$adminToken];
        $this->advanceToConditionalApproval($application, $headers);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', $this->requirementsData(), $headers)
            ->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'requirements_pending',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'approved_for_opening',
            'next_step_instructions' => 'Approved for opening.',
        ], $headers)->assertOk();

        $this->assertSame(0, Franchise::count());
        $this->assertSame(0, FranchiseAccount::count());
        $this->assertSame(0, FranchiseUser::count());

        $activated = $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', $this->activationData(), $headers)
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.franchise_account_id', fn ($value) => is_string($value))
            ->assertJsonPath('data.franchise_id', fn ($value) => is_string($value));

        $this->assertSame(1, Franchise::count());
        $this->assertSame(1, FranchiseAccount::count());
        $this->assertSame(1, FranchiseUser::count());
        $this->assertDatabaseHas('franchises', [
            'id' => $activated->json('data.franchise_id'),
            'franchise_account_id' => $activated->json('data.franchise_account_id'),
            'address' => 'Cebu City',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('franchise_users', [
            'email' => 'branch.manager@example.test',
            'franchise_id' => $activated->json('data.franchise_id'),
            'franchise_account_id' => $activated->json('data.franchise_account_id'),
            'can_process_pos' => true,
            'is_active' => true,
        ]);

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', $this->activationData(), $headers)
            ->assertStatus(409);
        $this->assertSame(1, Franchise::count());
        $this->assertSame(1, FranchiseAccount::count());
        $this->assertSame(1, FranchiseUser::count());

        $login = $this->postJson('/api/franchise/login', [
            'email' => 'branch.manager@example.test',
            'password' => 'BranchManagerPass123!',
        ])->assertOk();
        $this->getJson('/api/franchise/dashboard', [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])->assertOk();
    }

    public function test_only_an_admin_can_activate_and_manager_credentials_are_required(): void
    {
        $application = $this->createFranchiseApplication();
        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', $this->activationData())
            ->assertUnauthorized();

        $adminToken = $this->createAdminToken();
        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', [
            'manager_full_name' => 'Manager',
            'manager_email' => 'manager@example.test',
            'manager_password' => 'short',
            'can_process_pos' => true,
        ], ['Authorization' => 'Bearer '.$adminToken])->assertStatus(409);

        $this->assertSame(0, Franchise::count());
        $this->assertSame(0, FranchiseUser::count());
    }

    private function requirementsData(): array
    {
        return [
            'agreement_status' => 'signed',
            'agreement_prepared_at' => now('Asia/Manila')->toDateString(),
            'agreement_signed_at' => now('Asia/Manila')->toDateString(),
            'franchise_fee_amount' => null,
            'franchise_fee_payment_status' => 'not_applicable',
            'franchise_fee_payment_reference' => null,
            'required_documents' => [
                ['label' => 'Business registration', 'required' => true, 'status' => 'verified'],
            ],
            'location_readiness' => 'ready',
            'permit_compliance_status' => 'verified',
            'training_status' => 'complete',
            'operational_preparation_status' => 'complete',
            'internal_notes' => 'No franchise fee applies to this application.',
        ];
    }

    private function activationData(): array
    {
        return [
            'manager_full_name' => 'Branch Manager',
            'manager_email' => 'branch.manager@example.test',
            'manager_phone' => '09171112222',
            'manager_password' => 'BranchManagerPass123!',
            'can_process_pos' => true,
        ];
    }

    private function advanceToConditionalApproval(FranchiseApplication $application, array $headers): void
    {
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
            'next_step_instructions' => 'Complete the agreement and applicable opening requirements.',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'agreement_pending',
        ], $headers)->assertOk();
    }

    private function createFranchiseApplication(): FranchiseApplication
    {
        $token = Str::random(40);
        $user = User::create([
            'full_name' => 'Franchise Applicant',
            'email' => 'applicant@example.test',
            'phone' => '09170000000',
            'password' => 'SecurePassword1!',
            'api_token' => hash('sha256', $token),
            'email_verified_at' => now(),
        ]);
        $this->postJson('/api/franchise-applications', [
            'contact_name' => 'Franchise Applicant',
            'phone' => '09170000000',
            'location' => 'Cebu City',
            'applicant_address' => 'Cebu City, Cebu',
            'business_experience' => 'Five years operating a restaurant.',
            'investment_capacity' => 2500000,
            'has_proposed_property' => true,
            'opening_timeline' => '6_to_12_months',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        return FranchiseApplication::firstOrFail();
    }

    private function createAdminToken(): string
    {
        $token = 'franchise-activation-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-admin@test',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return $token;
    }
}
