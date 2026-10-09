<?php

namespace Tests\Feature;

use App\Models\FranchiseApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
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
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.user_id', $applicant['user']->id)
            ->assertJsonPath('data.email', $applicant['user']->email);

        $response->assertJsonPath('reference_number', $response->json('data.reference_number'));
        $this->assertMatchesRegularExpression('/^OPPA-\d{4}-[A-Z0-9]{8}$/', $response->json('reference_number'));
        $this->assertDatabaseHas('franchise_applications', [
            'id' => $response->json('data.id'),
            'reference_number' => $response->json('reference_number'),
            'user_id' => $applicant['user']->id,
            'status' => 'submitted',
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
            ->assertJsonPath('data.user_id', $applicant['user']->id);
    }

    public function test_guest_can_submit_with_contact_email_and_unverified_account_does_not_block_submission(): void
    {
        $guestSubmission = $this->postJson('/api/franchise-applications', array_merge(
            $this->applicationData(),
            ['email' => 'guest@example.test'],
        ))->assertCreated()
            ->assertJsonPath('data.user_id', null)
            ->assertJsonPath('data.email', 'guest@example.test');

        $this->assertMatchesRegularExpression('/^OPPA-\d{4}-[A-Z0-9]{8}$/', $guestSubmission->json('reference_number'));
        $this->postJson('/api/franchise-applications', $this->applicationData())
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Enter a contact email address.');

        $unverified = $this->createApplicant(false);
        $this->postJson('/api/franchise-applications', $this->applicationData(), [
            'Authorization' => 'Bearer '.$unverified['token'],
        ])->assertCreated()
            ->assertJsonPath('data.user_id', $unverified['user']->id);

        $this->assertDatabaseCount('franchise_applications', 2);
    }

    public function test_guest_cannot_access_authenticated_application_tracking(): void
    {
        $this->getJson('/api/franchise-applications/me')->assertUnauthorized();
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

    private function createVerifiedApplicant(string $email = 'applicant@example.test'): array
    {
        return $this->createApplicant(true, $email);
    }

    private function createApplicant(bool $verified, string $email = 'applicant@example.test'): array
    {
        $token = Str::random(40);
        $user = User::create([
            'full_name' => 'Franchise Applicant',
            'email' => $email,
            'phone' => '09170000000',
            'password' => 'SecurePassword1!',
            'api_token' => hash('sha256', $token),
            'email_verified_at' => $verified ? now() : null,
        ]);

        return ['user' => $user, 'token' => $token];
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
