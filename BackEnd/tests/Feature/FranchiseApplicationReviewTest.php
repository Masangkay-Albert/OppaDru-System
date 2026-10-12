<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Models\FranchiseUser;
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
        $this->getJson('/api/admin/franchise-applications/'.$application->id, [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk()
            ->assertJsonPath('data.allowed_transitions.0', 'under_review')
            ->assertJsonPath('data.allowed_transitions.1', 'additional_information_required');

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
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
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

        $interviewReview = [
            'status' => 'for_interview',
            'interview_at' => '2026-11-01T10:00:00+08:00',
            'interview_type' => 'online',
            'interview_notes' => 'Bring the operating plan.',
            'interview_meeting_url' => 'https://meet.example.test/franchise-interview',
            'next_step_instructions' => 'Your interview is scheduled. Please check your account email.',
        ];
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            ...$interviewReview,
            'interview_at' => now()->subDay()->toIso8601String(),
        ], $headers)->assertUnprocessable()
            ->assertJsonPath('errors.interview_at.0', 'Choose a current or future interview date and time.');

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, $interviewReview, $headers)->assertOk()
            ->assertJsonPath('data.status', 'for_interview');
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, $interviewReview, $headers)->assertOk();

        Auth::forgetGuards();
        $applicantView = $this->getJson('/api/franchise-applications/me', [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertOk();
        $this->assertNotEmpty($applicantView->json('data.0.interview_at'));
        $this->assertSame('online', $applicantView->json('data.0.interview_type'));
        $this->assertSame(
            'https://meet.example.test/franchise-interview',
            $applicantView->json('data.0.interview_meeting_url'),
        );
        $this->assertArrayNotHasKey('admin_notes', $applicantView->json('data.0'));
        $this->assertArrayNotHasKey('interview_notes', $applicantView->json('data.0'));

        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Interview scheduled',
            'message' => 'Interview scheduled for November 1, 2026 10:00 AM (Philippine time).',
            'is_internal' => false,
        ]);
        $this->assertSame(
            1,
            FranchiseApplicationEvent::where('application_id', $application->id)
                ->where('title', 'Interview scheduled')
                ->count(),
        );
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Interview notes added',
            'is_internal' => true,
        ]);
    }

    public function test_admin_can_schedule_an_onsite_interview_with_a_location_visible_to_the_applicant(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();

        $onsiteInterview = [
            'status' => 'for_interview',
            'interview_at' => '2026-11-01T10:00:00+08:00',
            'interview_type' => 'onsite',
            'interview_notes' => 'Discuss the operating plan.',
        ];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, $onsiteInterview, $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('interview_location');

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            ...$onsiteInterview,
            'interview_location' => 'Oppa Dru HQ, Cebu City',
        ], $headers)->assertOk()
            ->assertJsonPath('data.interview_type', 'onsite')
            ->assertJsonPath('data.interview_location', 'Oppa Dru HQ, Cebu City')
            ->assertJsonPath('data.interview_meeting_url', null);

        Auth::forgetGuards();
        $applicantView = $this->getJson('/api/franchise-applications/me', [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertOk();
        $this->assertSame('onsite', $applicantView->json('data.0.interview_type'));
        $this->assertSame('Oppa Dru HQ, Cebu City', $applicantView->json('data.0.interview_location'));
        $this->assertArrayNotHasKey('interview_notes', $applicantView->json('data.0'));
    }

    public function test_successful_post_interview_review_moves_application_into_step_four_then_step_five(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
            'interview_at' => '2026-11-01T10:00:00+08:00',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
        ], $headers)->assertOk()
            ->assertJsonPath('data.status', 'location_assessment')
            ->assertJsonPath('data.next_step_instructions', FranchiseApplication::defaultInstructionsFor('location_assessment'));

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'conditionally_approved',
        ], $headers)->assertOk()
            ->assertJsonPath('data.status', 'conditionally_approved')
            ->assertJsonPath('data.next_step_instructions', FranchiseApplication::defaultInstructionsFor('conditionally_approved'));

        $this->assertSame(
            ['for_interview', 'location_assessment', 'conditionally_approved'],
            FranchiseApplicationEvent::where('application_id', $application->id)
                ->where('title', 'Status updated')
                ->orderBy('id')
                ->pluck('status')
                ->all(),
        );
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
        ], ['Authorization' => 'Bearer '.$adminToken])->assertOk()
            ->assertJsonPath('data.status', 'conditionally_approved');

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'active',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'action' => 'approve',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable();

        $this->assertSame('conditionally_approved', $application->fresh()->status);
        $this->assertSame(0, Franchise::count());
    }

    public function test_admin_cannot_save_an_unsafe_interview_meeting_link(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
            'interview_meeting_url' => 'javascript:alert(1)',
        ], ['Authorization' => 'Bearer '.$adminToken])->assertUnprocessable()
            ->assertJsonValidationErrors('interview_meeting_url');
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
        $applicant = FranchiseApplicant::create([
            'full_name' => 'Franchise Applicant',
            'email' => 'applicant@example.test',
            'phone' => '09170000000',
            'password' => 'SecurePassword1!',
            'api_token' => hash('sha256', $token),
            'email_verified_at' => now(),
        ]);

        return ['applicant' => $applicant, 'token' => $token];
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
