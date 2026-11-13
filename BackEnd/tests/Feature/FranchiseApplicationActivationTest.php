<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Models\Product;
use App\Services\FranchiseProvisioningService;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class FranchiseApplicationActivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_activation_geocodes_the_branch_and_enables_delivery(): void
    {
        $menuItem = Product::create([
            'name' => 'New Branch Menu Item',
            'description' => 'Shared menu item',
            'price' => 120,
            'category' => 'rice',
            'image' => '',
            'is_available' => true,
        ]);
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(['lat' => 10.3157, 'lng' => 123.8854, 'matchedQuery' => 'Cebu City']));
        $applicant = FranchiseApplicant::create([
            'full_name' => 'Verified Franchise Applicant',
            'email' => 'verified-applicant@example.test',
            'phone' => '09170000000',
            'password' => 'ApplicantPass123!',
            'email_verified_at' => now(),
        ]);
        $application = FranchiseApplication::create([
            'franchise_applicant_id' => $applicant->id,
            'franchise_name' => 'Cebu Kitchen',
            'contact_name' => $applicant->full_name,
            'email' => $applicant->email,
            'location' => 'Cebu City',
            'status' => 'approved_for_opening',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
            'location_readiness' => 'ready',
            'permit_compliance_status' => 'verified',
            'training_status' => 'complete',
            'operational_preparation_status' => 'complete',
        ]);
        $adminToken = $this->createAdminToken();

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', [
            'can_process_pos' => true,
        ], ['Authorization' => 'Bearer '.$adminToken])
            ->assertCreated()
            ->assertJsonPath('data.franchise.latitude', 10.3157)
            ->assertJsonPath('data.franchise.longitude', 123.8854);

        $this->assertDatabaseHas('franchises', [
            'id' => $application->fresh()->franchise_id,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => config('delivery.default_radius_km'),
        ]);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $application->fresh()->franchise_id,
            'product_id' => $menuItem->id,
            'is_available' => true,
        ]);
    }

    public function test_provisioning_does_not_save_a_province_centroid_as_branch_coordinates(): void
    {
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn([
                'lat' => 14.1667,
                'lng' => 121.3333,
                'matchedQuery' => 'Laguna, Philippines',
                'isBroad' => true,
            ]));
        $applicant = FranchiseApplicant::create([
            'full_name' => 'Laguna Applicant',
            'email' => 'laguna-applicant@example.test',
            'phone' => '09170000001',
            'password' => 'ApplicantPass123!',
            'email_verified_at' => now(),
        ]);
        $application = FranchiseApplication::create([
            'franchise_applicant_id' => $applicant->id,
            'franchise_name' => 'Laguna Kitchen',
            'contact_name' => $applicant->full_name,
            'email' => $applicant->email,
            'location' => 'Laguna',
            'status' => 'approved_for_opening',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
            'location_readiness' => 'ready',
            'permit_compliance_status' => 'verified',
            'training_status' => 'complete',
            'operational_preparation_status' => 'complete',
        ]);

        $provisioned = app(FranchiseProvisioningService::class)->provisionOnApproval($application);

        $this->assertNull($provisioned);
        $this->assertSame(0, Franchise::count());
    }

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
        $menuItem = Product::create([
            'name' => 'Activated Branch Menu Item',
            'description' => 'Shared menu item',
            'price' => 120,
            'category' => 'rice',
            'image' => '',
            'is_available' => true,
        ]);
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(['lat' => 10.3157, 'lng' => 123.8854, 'matchedQuery' => 'Cebu City']));
        $adminToken = $this->createAdminToken();
        $application = $this->createFranchiseApplication();
        $application->franchise_applicant_id = null;
        $application->save();
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
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
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
        $this->getJson('/api/franchise/inventory', [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])->assertOk()
            ->assertJsonPath('data.items.0.id', $menuItem->id)
            ->assertJsonPath('data.items.0.branch_enabled', true)
            ->assertJsonPath('data.items.0.branch_available', true);
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

        $application->forceFill(['status' => 'approved_for_opening'])->save();
        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', [
            ...$this->activationData(),
            'manager_full_name' => str_repeat('M', 61),
            'manager_password' => str_repeat('P', 65),
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable()
            ->assertJsonValidationErrors(['manager_full_name', 'manager_password']);

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
        FranchiseApplicant::create([
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
