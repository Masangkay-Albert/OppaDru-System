<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use App\Models\Product;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;
use Tests\TestCase;

class FranchiseeLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_reports_application_eligibility_after_validating_applicant_password(): void
    {
        [$applicant, $application] = $this->createApplicantApplication();
        $cases = ['under_review', 'agreement_pending', 'on_hold', 'rejected', 'approved_for_opening'];

        foreach ($cases as $index => $status) {
            $application->forceFill(['status' => $status])->save();
            $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.'.($index + 1)])
                ->postJson('/api/franchise/login', [
                    'email' => $applicant->email,
                    'password' => 'ApplicantPass123!',
                ])->assertForbidden()->assertJsonPath('status', $status);
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
            'proposed_latitude' => 10.3157,
            'proposed_longitude' => 123.8854,
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
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(['lat' => 10.3157, 'lng' => 123.8854, 'matchedQuery' => 'Cebu City']));
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

        FranchiseApplication::create([
            'franchise_applicant_id' => $applicant->id,
            'franchise_name' => 'A later application',
            'contact_name' => $applicant->full_name,
            'email' => $applicant->email,
            'phone' => $applicant->phone,
            'location' => 'Davao City',
            'status' => 'under_review',
        ]);
        $franchiseeUser = FranchiseUser::where('email', $applicant->email)->firstOrFail();
        $this->assertTrue(Hash::check('ApplicantPass123!', \Illuminate\Support\Facades\DB::table('franchise_applicants')->where('id', $applicant->id)->value('password')), 'Applicant source credential must be valid.');
        $this->assertTrue(Hash::check('ApplicantPass123!', \Illuminate\Support\Facades\DB::table('franchise_users')->where('id', $franchiseeUser->id)->value('password')), 'Copied credential must be valid in storage.');
        $this->assertTrue(Hash::check('ApplicantPass123!', $franchiseeUser->password), 'The activated franchise user must retain the applicant password.');

        $login = $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'ApplicantPass123!',
        ])->assertOk()->assertJsonStructure(['token', 'franchise_user', 'expires_at']);
        $token = $login->json('token');
        $this->assertIsString($token);
        $this->assertNotEmpty($token);
        $cookie = collect($login->headers->getCookies())
            ->first(fn (Cookie $candidate) => $candidate->getName() === 'oppa_franchise_session');
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertNotNull($franchiseeUser->fresh()->api_token_expires_at);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/franchise/me')
            ->assertOk()
            ->assertJsonPath('franchise_user.email', $applicant->email);
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/franchise/dashboard')
            ->assertOk();

        $application->forceFill(['status' => 'on_hold'])->save();
        $reviewStatusLogin = $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'ApplicantPass123!',
        ])->assertOk();
        $reviewStatusCookie = collect($reviewStatusLogin->headers->getCookies())
            ->first(fn (Cookie $candidate) => $candidate->getName() === 'oppa_franchise_session');
        $this->assertNotNull($reviewStatusCookie);
        $reviewStatusToken = $reviewStatusLogin->json('token');
        $this->assertIsString($reviewStatusToken);
        $this->withHeader('Authorization', 'Bearer '.$reviewStatusToken)
            ->getJson('/api/franchise/dashboard')
            ->assertOk();
        $this->assertNotNull($franchiseeUser->fresh()->api_token);

        $franchiseeUser->franchise->forceFill(['status' => 'inactive'])->save();
        $this->withHeader('Authorization', 'Bearer '.$reviewStatusToken)
            ->getJson('/api/franchise/dashboard')
            ->assertForbidden()
            ->assertJsonPath('message', 'Your franchise access has been deactivated. Contact support.');
        $this->assertNull($franchiseeUser->fresh()->api_token);
    }

    public function test_invalid_password_is_generic_and_recorded_without_storing_the_password(): void
    {
        [$applicant] = $this->createApplicantApplication();

        $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'WrongPassword123!',
        ])->assertUnauthorized()->assertJsonPath('message', 'Incorrect email or password.');

        $this->assertDatabaseHas('franchise_auth_events', [
            'email_fingerprint' => hash('sha256', $applicant->email),
            'outcome' => 'blocked',
            'reason' => 'invalid_credentials',
        ]);
        $this->assertDatabaseMissing('franchise_auth_events', [
            'user_agent' => 'WrongPassword123!',
        ]);
    }

    public function test_final_approval_atomically_activates_franchise_and_login_uses_applicant_credentials(): void
    {
        Mail::fake();
        $menuItem = Product::create([
            'name' => 'Approval menu item',
            'description' => 'Menu item for new branch provisioning.',
            'price' => 100,
            'category' => 'Chicken',
            'image' => 'approval-menu-item.png',
            'is_available' => true,
        ]);
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(['lat' => 14.3294, 'lng' => 120.9367, 'matchedQuery' => 'Dasmarinas, Cavite']));
        [$applicant, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'status' => 'location_assessment',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
            'location_readiness' => 'ready',
            'permit_compliance_status' => 'verified',
            'training_status' => 'complete',
            'operational_preparation_status' => 'complete',
            'proposed_latitude' => 12.8797,
            'proposed_longitude' => 121.7740,
            'proposed_location_pin_confirmed' => false,
        ])->save();
        $adminToken = 'franchise-final-approval-admin-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-final-approval-admin@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk()->assertJsonPath('data.status', 'approved');

        $application->refresh();
        $franchiseUser = FranchiseUser::where('email', $applicant->email)->firstOrFail();
        $this->assertNotNull($application->approved_at);
        $this->assertNotNull($application->activated_at);
        $this->assertSame('active', $franchiseUser->franchise->status);
        $this->assertSame(14.3294, (float) $franchiseUser->franchise->latitude);
        $this->assertSame(120.9367, (float) $franchiseUser->franchise->longitude);
        $this->assertTrue($franchiseUser->franchise->is_active);
        $this->assertTrue($franchiseUser->franchise->accepts_online_orders);
        $this->assertTrue($franchiseUser->franchise->delivery_enabled);
        $this->assertSame((float) config('delivery.default_radius_km'), (float) $franchiseUser->franchise->delivery_radius_km);
        $this->assertDatabaseHas('franchise_inventory', [
            'franchise_id' => $franchiseUser->franchise->id,
            'product_id' => $menuItem->id,
            'is_available' => true,
        ]);
        $this->assertTrue(Hash::check('ApplicantPass123!', \Illuminate\Support\Facades\DB::table('franchise_users')->where('id', $franchiseUser->id)->value('password')), 'Approved applicant credentials must be copied to the franchise-user record.');
        $this->assertTrue(Hash::check('ApplicantPass123!', $franchiseUser->password), 'The approved franchise user must retain the applicant password.');

        $login = $this->postJson('/api/franchise/login', [
            'email' => $applicant->email,
            'password' => 'ApplicantPass123!',
        ])->assertOk()->assertJsonStructure(['token', 'franchise_user', 'expires_at']);
        $token = $login->json('token');
        $this->assertIsString($token);
        $cookie = collect($login->headers->getCookies())
            ->first(fn (Cookie $candidate) => $candidate->getName() === 'oppa_franchise_session');
        $this->assertNotNull($cookie);
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/franchise/dashboard')
            ->assertOk();
    }

    public function test_final_approval_activates_after_required_documents_are_verified(): void
    {
        $this->mock(GeocodingService::class, fn ($mock) => $mock
            ->shouldReceive('geocodeAddress')
            ->once()
            ->andReturn(['lat' => 14.3294, 'lng' => 120.9367, 'matchedQuery' => 'Dasmarinas, Cavite']));
        [$applicant, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'status' => 'location_assessment',
            'requirements_reviewed_at' => now(),
            'required_documents' => [
                ['label' => 'Business permit', 'required' => true, 'status' => 'verified'],
            ],
        ])->save();
        $adminToken = 'franchise-final-approval-documents-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-final-approval-documents@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('franchise_applications', [
            'id' => $application->id,
            'email' => $applicant->email,
            'status' => 'approved',
            'approval_override_reason' => null,
        ]);
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Opening readiness follow-up',
            'is_internal' => true,
        ]);
    }

    public function test_unresolved_address_can_be_recovered_with_an_optional_branch_pin(): void
    {
        Mail::fake();
        $geocoder = $this->mock(GeocodingService::class);
        $geocoder->shouldReceive('geocodeAddress')->twice()->andReturn(null);
        [$applicant, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'status' => 'location_assessment',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
        ])->save();
        $adminToken = 'franchise-final-approval-location-retry-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-final-approval-location-retry@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)
            ->assertStatus(409)
            ->assertJsonPath('code', 'BRANCH_LOCATION_UNRESOLVED')
            ->assertJsonPath('message', 'The proposed branch address could not be located precisely. Add a street, subdivision, or recognizable landmark to the proposed location and try approval again.');

        $this->assertDatabaseCount('franchises', 0);
        $this->assertDatabaseMissing('franchise_users', ['email' => $applicant->email]);
        $this->assertDatabaseHas('franchise_applications', [
            'id' => $application->id,
            'status' => 'location_assessment',
            'franchise_id' => null,
        ]);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
            'location' => 'Exact branch pin, Dasmarinas, Cavite',
            'proposed_latitude' => 14.3294,
            'proposed_longitude' => 120.9367,
            'proposed_location_pin_confirmed' => true,
        ], $headers)->assertOk();

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('provisioning_pending', false);

        $application->refresh();
        $franchise = $application->fresh()->franchise;
        $this->assertNotNull($franchise);
        $this->assertNotNull($franchise->latitude);
        $this->assertNotNull($franchise->longitude);
        $this->assertTrue($franchise->accepts_online_orders);
        $this->assertTrue($franchise->delivery_enabled);
        $this->assertSame((float) config('delivery.default_radius_km'), (float) $franchise->delivery_radius_km);
        $this->assertDatabaseCount('franchises', 1);
        $this->assertDatabaseHas('franchise_users', [
            'email' => $applicant->email,
            'franchise_id' => $franchise->id,
        ]);
    }

    public function test_reapproving_a_provisioned_application_does_not_create_another_branch(): void
    {
        $geocoder = $this->mock(GeocodingService::class);
        $geocoder->shouldReceive('geocodeAddress')
            ->twice()
            ->andReturn(['lat' => 14.3294, 'lng' => 120.9367, 'matchedQuery' => 'Dasmarinas, Cavite']);
        [, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'status' => 'location_assessment',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
        ])->save();
        $adminToken = 'franchise-final-approval-idempotent-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-final-approval-idempotent@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $approval = $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)
            ->assertOk();
        $franchiseId = $approval->json('data.franchise.id');
        $franchise = Franchise::findOrFail($franchiseId);
        $franchise->forceFill([
            'latitude' => 12.8797,
            'longitude' => 121.7740,
        ])->save();
        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)->assertOk();

        $this->assertSame($franchiseId, $application->fresh()->franchise_id);
        $this->assertSame(14.3294, (float) $franchise->fresh()->latitude);
        $this->assertSame(120.9367, (float) $franchise->fresh()->longitude);
        $this->assertDatabaseCount('franchises', 1);
        $this->assertDatabaseCount('franchise_users', 1);
    }

    public function test_reapproving_uses_a_specific_proposed_landmark_when_geocoder_returns_its_neighborhood(): void
    {
        $coordinates = [
            'lat' => 14.3261396,
            'lng' => 120.9670336,
            'matchedQuery' => 'Burol III, City of Dasmarinas, Cavite, Philippines',
            'isBroad' => true,
        ];
        $geocoder = $this->mock(GeocodingService::class);
        $geocoder->shouldReceive('geocodeAddress')->twice()->andReturn($coordinates);
        [, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'location' => 'Puregold, Burol III, City of Dasmarinas, Cavite',
            'status' => 'location_assessment',
            'agreement_status' => 'signed',
            'agreement_signed_at' => now(),
            'franchise_fee_payment_status' => 'not_applicable',
            'required_documents' => [],
            'requirements_reviewed_at' => now(),
        ])->save();
        $adminToken = 'franchise-landmark-geocode-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-landmark-geocode@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $approval = $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)
            ->assertOk();
        $franchise = Franchise::findOrFail($approval->json('data.franchise.id'));
        $franchise->forceFill([
            'latitude' => 12.8797,
            'longitude' => 121.7740,
            'location_status' => 'manual',
        ])->save();

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], $headers)->assertOk();

        $franchise->refresh();
        $this->assertSame((float) $coordinates['lat'], (float) $franchise->latitude);
        $this->assertSame((float) $coordinates['lng'], (float) $franchise->longitude);
        $this->assertSame('geocoded', $franchise->location_status);
    }

    public function test_final_approval_still_requires_requested_documents_to_be_verified(): void
    {
        [, $application] = $this->createApplicantApplication();
        $application->forceFill([
            'status' => 'location_assessment',
            'requirements_reviewed_at' => now(),
            'required_documents' => [
                ['label' => 'Business permit', 'required' => true, 'status' => 'submitted'],
            ],
        ])->save();
        $adminToken = 'franchise-final-approval-unverified-token';
        Admin::create([
            'full_name' => 'Franchise Admin',
            'email' => 'franchise-final-approval-unverified@example.test',
            'password' => Hash::make('AdminPassword123!'),
            'api_token' => hash('sha256', $adminToken),
        ]);

        $this->postJson('/api/admin/franchise-applications/'.$application->id.'/approve', [], [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertStatus(409)
            ->assertJsonPath('requirements.0', 'Required document not verified: Business permit.');

        $this->assertDatabaseHas('franchise_applications', [
            'id' => $application->id,
            'status' => 'location_assessment',
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
