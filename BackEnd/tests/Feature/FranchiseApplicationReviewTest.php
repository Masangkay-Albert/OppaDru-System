<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Models\FranchiseUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class FranchiseApplicationReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_review_an_application_without_activating_a_franchise(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
            'admin_notes' => 'Verify investment readiness.',
            'next_step_instructions' => 'Our team has started reviewing your information.',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk()
            ->assertJsonPath('data.status', 'under_review');

        $this->assertSame(0, Franchise::count());
        $this->assertSame(0, FranchiseAccount::count());
        $this->assertSame(0, FranchiseUser::count());
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Internal review note added',
            'is_internal' => true,
        ]);

        Auth::forgetGuards();
        $this->getJson('/api/franchise-applications/me/'.$application->id, [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertOk()
            ->assertJsonPath('data.status', 'under_review')
            ->assertJsonMissingPath('data.admin_notes')
            ->assertJsonMissing(['title' => 'Internal review note added']);
    }

    public function test_admin_can_request_information_and_schedule_an_interview(): void
    {
        $adminToken = $this->createAdminToken();
        $application = $this->submitApplication($this->createVerifiedApplicant());
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'additional_information_required',
        ], $headers)->assertUnprocessable();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'additional_information_required',
            'next_step_instructions' => 'Please provide your proposed property lease details.',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
        ], $headers)->assertUnprocessable();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
            'interview_at' => '2026-11-01T10:00:00+08:00',
            'interview_notes' => 'Bring the operating plan.',
            'next_step_instructions' => 'Your interview is scheduled. Please check your account email.',
        ], $headers)->assertOk()
            ->assertJsonPath('data.status', 'for_interview');

        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Interview scheduled',
            'is_internal' => false,
        ]);
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Interview notes added',
            'is_internal' => true,
        ]);
    }

    public function test_applicant_cannot_update_status_and_admin_cannot_skip_to_activation(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);

        $this->patchJson('/api/franchise-applications/me/'.$application->id, [
            'status' => 'conditionally_approved',
        ], ['Authorization' => 'Bearer '.$applicant['token']])->assertMethodNotAllowed();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertStatus(409);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'active',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'action' => 'approve',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable();

        $this->assertSame('submitted', $application->fresh()->status);
        $this->assertSame(0, Franchise::count());
    }

    private function submitApplication(array $applicant): FranchiseApplication
    {
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
        $token = 'franchise-review-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-admin@test',
            'password' => Hash::make('Admin@123'),
            'api_token' => hash('sha256', $token),
        ]);

        return $token;
    }
}
