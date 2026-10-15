<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;
use Tests\TestCase;

class FranchiseeLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_reports_application_eligibility_after_validating_applicant_password(): void
    {
        [$applicant, $application] = $this->createApplicantApplication();
        $cases = [
            ['under_review', 'Your application is still under review.'],
            ['agreement_pending', 'Please complete your franchise agreement first.'],
            ['on_hold', 'Your application is currently on hold. Please contact support.'],
            ['rejected', 'Your application was not approved.'],
            ['approved_for_opening', 'Your application is approved. Franchise activation is pending.'],
        ];

        foreach ($cases as $index => [$status, $message]) {
            $application->forceFill(['status' => $status])->save();
            $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.'.($index + 1)])
                ->postJson('/api/franchise/login', [
                    'email' => $applicant->email,
                    'password' => 'ApplicantPass123!',
                ])->assertForbidden()->assertJsonPath('message', $message);
        }

        $this->assertDatabaseCount('franchise_auth_events', 5);
        $this->assertDatabaseHas('franchise_auth_events', [
            'email_fingerprint' => hash('sha256', $applicant->email),
            'outcome' => 'blocked',
            'reason' => 'not_eligible',
        ]);
    }

    public function test_activated_applicant_uses_existing_credentials_and_loses_access_when_application_is_held(): void
    {
        [$applicant, $application] = $this->createApplicantApplication();
        $application->forceFill([
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
        ])->save();
        $adminToken = 'franchisee-login-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchisee-login-admin@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/activate', [
            'can_process_pos' => true,
        ], ['Authorization' => 'Bearer '.$adminToken])->assertCreated();

        $franchiseeUser = FranchiseUser::where('email', $applicant->email)->firstOrFail();
        $this->assertTrue(Hash::check('ApplicantPass123!', $franchiseeUser->password));

        $login = $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'ApplicantPass123!',
        ])->assertOk()->assertJsonMissingPath('token');
        $cookie = collect($login->headers->getCookies())
            ->first(fn (Cookie $candidate) => $candidate->getName() === 'oppa_franchise_session');
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertNotNull($franchiseeUser->fresh()->api_token_expires_at);

        $this->withCookie('oppa_franchise_session', $cookie->getValue())
            ->getJson('/api/franchise/dashboard')
            ->assertOk();

        $application->forceFill(['status' => 'on_hold'])->save();
        $this->withCookie('oppa_franchise_session', $cookie->getValue())
            ->getJson('/api/franchise/dashboard')
            ->assertForbidden()
            ->assertJsonPath('message', 'Your application is currently on hold. Please contact support.');
        $this->assertNull($franchiseeUser->fresh()->api_token);
    }

    public function test_invalid_password_is_generic_and_recorded_without_storing_the_password(): void
    {
        [$applicant] = $this->createApplicantApplication();

        $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'WrongPassword123!',
        ])->assertUnauthorized()->assertJsonPath('message', 'Invalid email or password.');

        $this->assertDatabaseHas('franchise_auth_events', [
            'email_fingerprint' => hash('sha256', $applicant->email),
            'outcome' => 'blocked',
            'reason' => 'invalid_credentials',
        ]);
        $this->assertDatabaseMissing('franchise_auth_events', [
            'user_agent' => 'WrongPassword123!',
        ]);
    }

    private function createApplicantApplication(): array
    {
        $rawToken = Str::random(40);
        $applicant = FranchiseApplicant::create([
            'full_name' => 'Franchise Applicant',
            'email' => 'franchisee@example.test',
            'phone' => '09170000000',
            'password' => 'ApplicantPass123!',
            'api_token' => hash('sha256', $rawToken),
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/franchise-applications', [
            'contact_name' => $applicant->full_name,
            'email' => $applicant->email,
            'phone' => $applicant->phone,
            'location' => 'Cebu City',
            'applicant_address' => 'Cebu City, Cebu',
            'business_experience' => 'Five years operating a restaurant.',
            'investment_capacity' => 2500000,
            'has_proposed_property' => true,
            'opening_timeline' => '6_to_12_months',
        ], ['Authorization' => 'Bearer '.$rawToken])->assertCreated();

        return [$applicant, FranchiseApplication::where('franchise_applicant_id', $applicant->id)->firstOrFail()];
    }
}
