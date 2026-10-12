<?php

namespace Tests\Feature;

use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Models\User;
use App\Notifications\VerifyFranchiseApplicantEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FranchiseApplicationSubmissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_applicant_can_submit_and_receive_a_reference_number(): void
    {
        $applicant = $this->createVerifiedApplicant();

        $response = $this->postJson('/api/franchise-applications', $this->applicationData(), [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'under_review')
            ->assertJsonPath('data.email', $applicant['applicant']->email)
            ->assertJsonMissingPath('data.user_id')
            ->assertJsonMissingPath('data.franchise_applicant_id');

        $response->assertJsonPath('reference_number', $response->json('data.reference_number'));
        $this->assertMatchesRegularExpression('/^OPPA-\d{4}-[A-Z0-9]{8}$/', $response->json('reference_number'));
        $this->assertDatabaseHas('franchise_applications', [
            'id' => $response->json('data.id'),
            'reference_number' => $response->json('reference_number'),
            'franchise_applicant_id' => $applicant['applicant']->id,
            'user_id' => null,
            'status' => 'under_review',
        ]);
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $response->json('data.id'),
            'status' => 'under_review',
            'title' => 'Application submitted',
        ]);
    }

    public function test_applicant_can_provide_a_contact_email_different_from_their_account_email(): void
    {
        $applicant = $this->createVerifiedApplicant();
        $contactEmail = 'franchise.contact@example.test';

        $this->postJson('/api/franchise-applications', array_merge(
            $this->applicationData(),
            ['email' => $contactEmail],
        ), [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertCreated()
            ->assertJsonPath('data.email', $contactEmail)
            ->assertJsonMissingPath('data.user_id');
    }

    public function test_franchise_application_submission_requires_a_verified_account(): void
    {
        $this->postJson('/api/franchise-applications', array_merge(
            $this->applicationData(),
            ['email' => 'guest@example.test'],
        ))->assertUnauthorized();

        $unverified = $this->createApplicant(false);
        $this->postJson('/api/franchise-applications', $this->applicationData(), [
            'Authorization' => 'Bearer '.$unverified['token'],
        ])->assertForbidden();

        $this->assertDatabaseCount('franchise_applications', 0);
    }

    public function test_guest_cannot_access_authenticated_application_tracking(): void
    {
        $this->getJson('/api/franchise-applications/me')->assertUnauthorized();
    }

    public function test_guest_can_track_application_with_reference_number_and_contact_email(): void
    {
        $application = $this->createLegacyApplication('guest@example.test');
        $application->update([
            'interview_meeting_url' => 'https://meet.example.test/guest-interview',
        ]);

        $this->postJson('/api/franchise-applications/track', [
            'reference_number' => strtolower($application->reference_number),
            'email' => 'GUEST@example.test',
        ])->assertOk()
            ->assertJsonPath('data.status', 'under_review')
            ->assertJsonPath('data.interview_meeting_url', 'https://meet.example.test/guest-interview')
            ->assertJsonMissingPath('data.admin_notes')
            ->assertJsonMissingPath('data.interview_notes');
    }

    public function test_guest_cannot_track_application_with_an_unmatched_contact_email(): void
    {
        $application = $this->createLegacyApplication('guest@example.test');

        $this->postJson('/api/franchise-applications/track', [
            'reference_number' => $application->reference_number,
            'email' => 'other@example.test',
        ])->assertNotFound();
    }

    public function test_only_the_applicant_can_view_or_download_their_application_documents(): void
    {
        Storage::fake('local');
        $applicant = $this->createVerifiedApplicant('owner@example.test');
        $otherApplicant = $this->createVerifiedApplicant('other@example.test');

        $response = $this->post('/api/franchise-applications', array_merge(
            $this->applicationData(),
            ['documents' => [UploadedFile::fake()->create('business-plan.pdf', 128, 'application/pdf')]],
        ), [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertCreated();

        $applicationId = $response->json('data.id');
        $this->getJson('/api/franchise-applications/me', [
            'Authorization' => 'Bearer '.$applicant['token'],
        ])->assertOk()->assertJsonCount(1, 'data');

        Auth::forgetGuards();
        $this->getJson('/api/franchise-applications/me/'.$applicationId, [
            'Authorization' => 'Bearer '.$otherApplicant['token'],
        ])->assertNotFound();

        Auth::forgetGuards();
        $this->getJson('/api/franchise-applications/'.$applicationId.'/documents/0', [
            'Authorization' => 'Bearer '.$otherApplicant['token'],
        ])->assertNotFound();

        $application = FranchiseApplication::findOrFail($applicationId);
        Storage::disk('local')->assertExists($application->documents[0]['path']);
        Auth::forgetGuards();
        $this->get('/api/franchise-applications/'.$applicationId.'/documents/0', [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertOk();
    }

    public function test_applicant_cannot_submit_a_second_open_application(): void
    {
        $applicant = $this->createVerifiedApplicant();
        $headers = ['Authorization' => 'Bearer '.$applicant['token']];

        $this->postJson('/api/franchise-applications', $this->applicationData(), $headers)->assertCreated();
        $this->postJson('/api/franchise-applications', $this->applicationData(), $headers)->assertStatus(409);
        $this->assertDatabaseCount('franchise_applications', 1);
    }

    public function test_customer_credentials_cannot_sign_in_to_the_franchise_applicant_portal(): void
    {
        User::create([
            'full_name' => 'Customer Account',
            'email' => 'shared@example.test',
            'password' => 'SecurePassword1!',
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/franchise-applicants/login', [
            'email' => 'shared@example.test',
            'password' => 'SecurePassword1!',
        ])->assertUnauthorized();
    }

    public function test_franchise_manager_credentials_cannot_sign_in_to_the_applicant_portal(): void
    {
        FranchiseUser::create([
            'id' => 'OPPA-FR-TEST',
            'full_name' => 'Franchise Manager',
            'email' => 'manager@example.test',
            'password' => 'SecurePassword1!',
            'is_active' => true,
        ]);

        $this->postJson('/api/franchise-applicants/login', [
            'email' => 'manager@example.test',
            'password' => 'SecurePassword1!',
        ])->assertUnauthorized();
    }

    public function test_applicant_registration_is_separate_and_requires_email_verification(): void
    {
        Notification::fake();

        $this->postJson('/api/franchise-applicants/register', [
            'full_name' => 'New Franchise Applicant',
            'email' => 'new.applicant@example.test',
            'phone' => '09170000000',
            'password' => 'SecurePassword1!',
            'password_confirmation' => 'SecurePassword1!',
        ])->assertCreated()
            ->assertJsonPath('applicant.email', 'new.applicant@example.test');

        $this->assertDatabaseCount('users', 0);
        $applicant = FranchiseApplicant::where('email', 'new.applicant@example.test')->firstOrFail();
        Notification::assertSentTo($applicant, VerifyFranchiseApplicantEmail::class);

        $this->postJson('/api/franchise-applicants/login', [
            'email' => 'new.applicant@example.test',
            'password' => 'SecurePassword1!',
        ])->assertForbidden();

        $applicant->markEmailAsVerified();
        $this->postJson('/api/franchise-applicants/login', [
            'email' => 'new.applicant@example.test',
            'password' => 'SecurePassword1!',
        ])->assertOk()->assertJsonPath('applicant.id', $applicant->id);
    }

    private function createVerifiedApplicant(string $email = 'applicant@example.test'): array
    {
        return $this->createApplicant(true, $email);
    }

    private function createLegacyApplication(string $email): FranchiseApplication
    {
        return FranchiseApplication::create([
            'franchise_name' => 'Oppa Dru - Cebu City',
            'contact_name' => 'Guest Franchise Applicant',
            'email' => $email,
            'phone' => '09170000000',
            'location' => 'Cebu City',
            'status' => 'under_review',
        ]);
    }

    private function createApplicant(bool $verified, string $email = 'applicant@example.test'): array
    {
        $token = Str::random(40);
        $applicant = FranchiseApplicant::create([
            'full_name' => 'Franchise Applicant',
            'email' => $email,
            'phone' => '09170000000',
            'password' => 'SecurePassword1!',
            'api_token' => hash('sha256', $token),
            'email_verified_at' => $verified ? now() : null,
        ]);

        return ['applicant' => $applicant, 'token' => $token];
    }

    private function applicationData(): array
    {
        return [
            'contact_name' => 'Franchise Applicant',
            'phone' => '09170000000',
            'location' => 'Cebu City',
            'applicant_address' => 'Cebu City, Cebu',
            'business_experience' => 'Five years managing a food-service team.',
            'investment_capacity' => 2500000,
            'has_proposed_property' => true,
            'opening_timeline' => '6_to_12_months',
            'business_information' => 'Interested in a high-foot-traffic location.',
        ];
    }
}
