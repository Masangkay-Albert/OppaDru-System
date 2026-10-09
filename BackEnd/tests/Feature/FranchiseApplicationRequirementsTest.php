<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\FranchiseApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class FranchiseApplicationRequirementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_record_conditional_agreement_and_opening_requirements(): void
    {
        $adminToken = $this->createAdminToken();
        $application = $this->createFranchiseApplication();
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', array_merge(
            $this->requirementsData(),
            ['agreement_prepared_at' => now('Asia/Manila')->subDay()->toDateString()],
        ), $headers)->assertOk()
            ->assertJsonPath('data.agreement_status', 'drafting');

        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', $this->requirementsData(), $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.agreement_status', 'drafting');

        $this->assertSame('submitted', $application->fresh()->status);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
            'next_step_instructions' => 'Please review the agreement and outstanding pre-opening requirements.',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'requirements_pending',
        ], $headers)->assertStatus(409)
            ->assertJsonPath('message', 'The application cannot move from conditionally_approved to requirements_pending.');
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'agreement_pending',
        ], $headers)->assertOk();
        $this->assertSame(
            FranchiseApplication::defaultInstructionsFor('agreement_pending'),
            $application->fresh()->next_step_instructions,
        );

        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', $this->requirementsData(), $headers)
            ->assertOk()
            ->assertJsonPath('data.agreement_status', 'drafting')
            ->assertJsonPath('data.status', 'agreement_pending')
            ->assertJsonPath('data.franchise_fee_payment_status', 'not_configured');

        $this->assertDatabaseHas('franchise_applications', [
            'id' => $application->id,
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
        ]);
    }

    public function test_fee_cannot_be_marked_paid_without_amount_and_reference_and_applicant_cannot_edit_requirements(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->createFranchiseApplication($applicant);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->advanceToConditionalApproval($application, $headers);
        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', array_merge(
            $this->requirementsData(),
            ['franchise_fee_payment_status' => 'paid'],
        ), $headers)->assertUnprocessable();

        Auth::forgetGuards();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id.'/requirements', $this->requirementsData(), [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertUnauthorized();
    }

    public function test_applicant_can_respond_to_an_information_request_and_withdraw_an_eligible_application(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->createFranchiseApplication($applicant);
        $adminHeaders = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $adminHeaders)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'additional_information_required',
            'next_step_instructions' => 'Please provide an updated business plan.',
        ], $adminHeaders)->assertOk();

        Auth::forgetGuards();
        $this->postJson('/api/franchise-applications/me/'.$application->id.'/response', [
            'response' => 'I have attached the updated plan.',
        ], ['Authorization' => 'Bearer '.$applicant['token']])->assertOk();
        $this->assertSame('under_review', $application->fresh()->status);

        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Additional information submitted',
            'actor_type' => 'applicant',
        ]);

        Auth::forgetGuards();
        $this->patchJson('/api/franchise-applications/me/'.$application->id.'/withdraw', [], [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertOk();
        $this->assertSame('withdrawn', $application->fresh()->status);
    }

    public function test_admin_can_configure_the_public_franchise_program(): void
    {
        $adminToken = $this->createAdminToken();

        $this->putJson('/api/admin/franchise-opportunities', [
            'investment_minimum' => 1500000,
            'investment_maximum' => 3500000,
            'franchise_fee' => 500000,
            'requirements' => "Business plan\nProposed location",
            'qualifications' => 'Restaurant experience',
            'business_rules' => 'Follow brand standards',
            'support' => "Initial training\nOpening support",
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk()
            ->assertJsonPath('data.investment.minimum', '1500000.00')
            ->assertJsonPath('data.investment.maximum', '3500000.00')
            ->assertJsonPath('data.franchise_fee', '500000.00')
            ->assertJsonPath('data.requirements.0', 'Business plan')
            ->assertJsonPath('data.support.1', 'Opening support');

        $this->putJson('/api/admin/franchise-opportunities', [
            'investment_minimum' => 3500000,
            'investment_maximum' => 1500000,
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable();

        Auth::forgetGuards();
        $this->putJson('/api/admin/franchise-opportunities', [
            'investment_minimum' => 10,
        ])->assertUnauthorized();
    }

    private function requirementsData(): array
    {
        return [
            'agreement_status' => 'drafting',
            'agreement_prepared_at' => now('Asia/Manila')->toDateString(),
            'agreement_signed_at' => null,
            'franchise_fee_amount' => null,
            'franchise_fee_payment_status' => 'not_configured',
            'franchise_fee_payment_reference' => null,
            'required_documents' => [],
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
        ];
    }

    private function advanceToConditionalApproval(FranchiseApplication $application, array $headers): void
    {
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
        ], $headers)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'agreement_pending',
        ], $headers)->assertOk();
    }

    private function createFranchiseApplication(?array $applicant = null): FranchiseApplication
    {
        if (! $applicant) {
            $applicant = $this->createVerifiedApplicant();
        }
        $this->postJson('/api/franchise-applications', [
            'contact_name' => 'Franchise Applicant',
            'phone' => '09170000000',
            'location' => 'Cebu City',
            'applicant_address' => 'Cebu City, Cebu',
            'business_experience' => 'Five years operating a restaurant.',
            'investment_capacity' => 2500000,
            'has_proposed_property' => true,
            'opening_timeline' => '6_to_12_months',
        ], ['Authorization' => 'Bearer '.$applicant['token']])->assertCreated();

        return FranchiseApplication::firstOrFail();
    }

    private function createVerifiedApplicant(): array
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

        return ['user' => $user, 'token' => $token];
    }

    private function createAdminToken(): string
    {
        $token = 'franchise-requirements-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-admin@test',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return $token;
    }
}
