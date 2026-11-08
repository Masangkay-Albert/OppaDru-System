<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Models\FranchiseUser;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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
            ->assertJsonMissing(['additional_information_required'])
            ->assertJsonFragment(['on_hold']);

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
        ], $headers)->assertStatus(409);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'additional_information_required',
            'next_step_instructions' => 'Please provide your proposed property lease details.',
        ], $headers)->assertStatus(409);

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
        ], $headers)->assertUnprocessable();

        $interviewAt = now()->addDays(3)->setTime(10, 0)->toIso8601String();
        $interviewReview = [
            'status' => 'for_interview',
            'interview_at' => $interviewAt,
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
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            ...$interviewReview,
            'interview_at' => now('Asia/Manila')->addYear()->setTime(10, 0)->toIso8601String(),
        ], $headers)->assertUnprocessable()
            ->assertJsonPath('errors.interview_at.0', 'Choose an interview date within this calendar year.');

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
        $this->postJson('/api/franchise-applications/track', [
            'reference_number' => $application->reference_number,
            'email' => $applicant['applicant']->email,
        ])->assertOk()
            ->assertJsonPath('data.interview_meeting_url', 'https://meet.example.test/franchise-interview');
        $this->assertArrayNotHasKey('admin_notes', $applicantView->json('data.0'));
        $this->assertArrayNotHasKey('interview_notes', $applicantView->json('data.0'));

        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Interview scheduled',
            'message' => 'Interview scheduled for '.CarbonImmutable::parse($interviewAt)
                ->setTimezone('Asia/Manila')
                ->format('F j, Y g:i A').' (Philippine time).',
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
            'interview_at' => now()->addDays(3)->setTime(10, 0)->toIso8601String(),
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

    public function test_successful_post_interview_review_accepts_one_combined_document_packet(): void
    {
        Storage::fake('local');
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $headers = ['Authorization' => 'Bearer '.$adminToken];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
            'interview_at' => now()->addDays(3)->setTime(10, 0)->toIso8601String(),
        ], $headers)->assertOk();

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
        ], $headers)->assertOk()
            ->assertJsonPath('data.status', 'location_assessment')
            ->assertJsonPath('data.next_step_instructions', FranchiseApplication::defaultInstructionsFor('location_assessment'));

        $requirementsPayload = [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => '',
            'agreement_signed_at' => '',
            'franchise_fee_amount' => '',
            'franchise_fee_payment_status' => 'not_configured',
            'franchise_fee_payment_reference' => '',
            'required_documents' => json_encode([
                ['label' => 'Property application form', 'required' => true, 'status' => 'pending', 'template_name' => null],
            ]),
            'required_document_templates' => [
                0 => UploadedFile::fake()->create('property-application-form.pdf', 100, 'application/pdf'),
            ],
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
            'internal_notes' => '',
        ];
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', $requirementsPayload, $headers + ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.status', 'location_assessment')
            ->assertJsonPath('data.next_step_instructions', "Please complete and upload the following required documents together:\n- Property application form")
            ->assertJsonPath('message', 'Required documents saved. The applicant can now upload the requested document packet.');

        Auth::forgetGuards();
        $this->get('/api/franchise-applications/me/'.$application->id.'/required-documents/0/template', [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertHeader('content-disposition');

        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Document packet requested',
        ]);

        Auth::forgetGuards();
        $this->post('/api/franchise-applications/me/'.$application->id.'/response', [
            'response' => 'I have attached the complete requested document packet.',
        ], [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertUnprocessable()
            ->assertJsonPath('missing_documents.0', 'Property application form');

        Auth::forgetGuards();
        $this->post('/api/franchise-applications/me/'.$application->id.'/response', [
            'response' => 'I have attached the complete requested document packet.',
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('completed-property-application.pdf', 100, 'application/pdf'),
            ],
        ], [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.status', 'location_assessment')
            ->assertJsonPath('data.next_step_instructions', 'Your complete document packet was received. The franchise team will continue the site assessment and final review.')
            ->assertJsonCount(1, 'data.documents')
            ->assertJsonPath('data.documents.0.name', 'completed-property-application.pdf')
            ->assertJsonPath('data.required_documents.0.status', 'submitted')
            ->assertJsonPath('data.required_documents.0.submitted_document_name', 'completed-property-application.pdf')
            ->assertJsonFragment(['title' => 'Documents submitted'])
            ->assertJsonMissingPath('data.required_documents.0.template_path');

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
            'request_document_packet' => true,
            'next_step_instructions' => 'Requesting another document packet.',
        ], $headers)->assertStatus(409);

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

    public function test_admin_can_download_an_applicant_document_from_the_configured_storage_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.default' => 's3']);

        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $submission = $this->post('/api/franchise-applications', [
            'contact_name' => 'Franchise Applicant',
            'phone' => '09170000000',
            'location' => 'Cebu City',
            'applicant_address' => 'Cebu City, Cebu',
            'business_experience' => 'Five years operating a restaurant.',
            'investment_capacity' => 2500000,
            'has_proposed_property' => true,
            'opening_timeline' => '6_to_12_months',
            'documents' => [
                UploadedFile::fake()->createWithContent('business-plan.pdf', 'business plan content'),
            ],
        ], [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertCreated();

        $application = FranchiseApplication::findOrFail($submission->json('data.id'));
        $this->assertSame('s3', $application->documents[0]['disk']);
        Storage::disk('s3')->assertExists($application->documents[0]['path']);

        Auth::forgetGuards();
        $download = $this->get('/api/admin/franchise-applications/'.$application->id.'/documents/0', [
            'Authorization' => 'Bearer '.$adminToken,
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertHeader('content-disposition');
        $this->assertSame('business plan content', $download->streamedContent());
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

    public function test_applicant_can_submit_image_payment_proof_for_admin_review(): void
    {
        Storage::fake('local');
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $application->forceFill([
            'status' => 'location_assessment',
            'franchise_fee_amount' => 5000,
            'franchise_fee_payment_status' => 'pending',
        ])->save();

        Auth::forgetGuards();
        $response = $this->post('/api/franchise-applications/me/'.$application->id.'/payment-proof', [
            'proof' => UploadedFile::fake()->create('payment-proof.png', 100, 'image/png'),
        ], [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.franchise_fee_payment_status', 'submitted')
            ->assertJsonPath('data.documents.0.name', 'payment-proof.png')
            ->assertJsonPath('data.documents.0.document_type', 'payment_proof')
            ->assertJsonMissingPath('data.documents.0.path');

        $storedPath = $application->fresh()->documents[0]['path'];
        $this->assertTrue(Storage::disk('local')->exists($storedPath));

        $requirementsPayload = [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => '',
            'agreement_signed_at' => '',
            'franchise_fee_amount' => '5000',
            'franchise_fee_payment_status' => 'paid',
            'required_documents' => '[]',
            'required_document_templates' => [],
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
            'internal_notes' => '',
        ];
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', $requirementsPayload, [
            'Authorization' => 'Bearer '.$adminToken,
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.franchise_fee_payment_status', 'paid');
    }

    public function test_admin_cannot_set_past_agreement_dates(): void
    {
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);

        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => now('Asia/Manila')->subDay()->toDateString(),
            'agreement_signed_at' => '',
            'franchise_fee_payment_status' => 'not_configured',
            'required_documents' => '[]',
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
        ], [
            'Authorization' => 'Bearer '.$adminToken,
            'Accept' => 'application/json',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('agreement_prepared_at');
    }

    public function test_applicant_can_submit_documents_sent_by_the_franchise_team_after_location_assessment(): void
    {
        Storage::fake('local');
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $adminHeaders = ['Authorization' => 'Bearer '.$adminToken, 'Accept' => 'application/json'];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
        ], $adminHeaders)->assertOk();
        $requirementsPayload = [
            '_method' => 'PATCH',
            'required_documents' => json_encode([
                ['label' => 'Location plan', 'category' => 'location_readiness', 'required' => true, 'status' => 'pending'],
            ]),
        ];
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', $requirementsPayload, $adminHeaders)
            ->assertOk()
            ->assertJsonPath('message', 'Required documents saved. The applicant can now upload the requested document packet.');
        $this->assertDatabaseHas('franchise_application_events', [
            'application_id' => $application->id,
            'title' => 'Document packet requested',
        ]);

        Auth::forgetGuards();
        $this->post('/api/franchise-applications/me/'.$application->id.'/response', [
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('location-plan.pdf', 100, 'application/pdf'),
            ],
        ], [
            'Authorization' => 'Bearer '.$applicant['token'],
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.status', 'location_assessment')
            ->assertJsonPath('data.required_documents.0.category', 'location_readiness')
            ->assertJsonMissingPath('data.required_documents.0.template_name')
            ->assertJsonPath('data.documents.0.name', 'location-plan.pdf')
            ->assertJsonPath('data.required_documents.0.status', 'submitted');
    }

    public function test_public_tracking_exposes_every_requirement_and_secures_template_document_and_payment_uploads(): void
    {
        $this->travel(2)->minutes();
        Storage::fake('local');
        $adminToken = $this->createAdminToken();
        $applicant = $this->createVerifiedApplicant();
        $application = $this->submitApplication($applicant);
        $adminHeaders = ['Authorization' => 'Bearer '.$adminToken, 'Accept' => 'application/json'];

        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'under_review',
        ], $adminHeaders)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'for_interview',
            'interview_at' => now('Asia/Manila')->addDays(5)->toIso8601String(),
        ], $adminHeaders)->assertOk();
        $this->patchJson('/api/admin/franchise-applications/'.$application->id, [
            'status' => 'location_assessment',
        ], $adminHeaders)->assertOk();

        $labels = ['Agreement signing form', 'Payment instructions', 'docu three'];
        $categories = ['agreement_signing', 'payment', 'application_documents'];
        $requiredDocuments = array_map(
            fn (string $label, string $category) => ['label' => $label, 'category' => $category, 'required' => true, 'status' => 'pending'],
            $labels,
            $categories,
        );
        $templates = array_map(
            fn (int $index) => UploadedFile::fake()->create("blank-form-$index.pdf", 100, 'application/pdf'),
            array_keys($labels),
        );
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => '',
            'agreement_signed_at' => '',
            'franchise_fee_amount' => '500000',
            'franchise_fee_payment_status' => 'pending',
            'required_documents' => json_encode($requiredDocuments),
            'required_document_templates' => $templates,
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
            'internal_notes' => '',
        ], $adminHeaders)->assertOk()
            ->assertJsonPath('data.next_step_instructions', "Please complete and upload the following required documents together:\n- Agreement signing form\n- Payment instructions\n- docu three");

        Auth::forgetGuards();
        $trackingCredentials = [
            'reference_number' => $application->fresh()->reference_number,
            'email' => $applicant['applicant']->email,
        ];
        $this->postJson('/api/franchise-applications/track', $trackingCredentials)->assertOk()
            ->assertJsonCount(3, 'data.required_documents')
            ->assertJsonPath('data.required_documents.0.label', 'Agreement signing form')
            ->assertJsonPath('data.required_documents.0.category', 'agreement_signing')
            ->assertJsonPath('data.required_documents.1.label', 'Payment instructions')
            ->assertJsonPath('data.required_documents.1.category', 'payment')
            ->assertJsonPath('data.required_documents.2.label', 'docu three')
            ->assertJsonMissingPath('data.admin_notes');

        $this->postJson('/api/franchise-applications/track/document-template', [
            ...$trackingCredentials,
            'document' => 1,
        ])->assertOk()->assertHeader('content-disposition');
        $this->postJson('/api/franchise-applications/track/document-template', [
            ...$trackingCredentials,
            'email' => 'someone-else@example.test',
            'document' => 1,
        ])->assertNotFound();

        $this->post('/api/franchise-applications/track/documents', [
            ...$trackingCredentials,
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('not-a-document.exe', 100, 'application/octet-stream'),
            ],
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors('required_document_uploads.0');

        $this->post('/api/franchise-applications/track/documents', [
            ...$trackingCredentials,
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('oversized-form.pdf', 10241, 'application/pdf'),
            ],
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors('required_document_uploads.0');

        $this->post('/api/franchise-applications/track/documents', [
            ...$trackingCredentials,
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('completed-one.pdf', 100, 'application/pdf'),
                1 => UploadedFile::fake()->create('completed-two.pdf', 100, 'application/pdf'),
                2 => UploadedFile::fake()->create('completed-three.pdf', 100, 'application/pdf'),
            ],
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonCount(3, 'data.required_documents')
            ->assertJsonPath('data.required_documents.0.status', 'submitted')
            ->assertJsonPath('data.required_documents.1.status', 'submitted')
            ->assertJsonPath('data.required_documents.2.status', 'submitted')
            ->assertJsonFragment(['title' => 'Documents submitted'])
            ->assertJsonMissingPath('data.admin_notes');

        $this->post('/api/franchise-applications/track/documents', [
            'reference_number' => $trackingCredentials['reference_number'],
            'email' => 'someone-else@example.test',
        ], ['Accept' => 'application/json'])->assertNotFound();

        $reviewedDocuments = $application->fresh()->required_documents;
        $reviewedDocuments[0]['status'] = 'rejected';
        $reviewedDocuments[0]['reject_reason'] = 'Please provide a signed copy.';
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => '',
            'agreement_signed_at' => '',
            'franchise_fee_amount' => '500000',
            'franchise_fee_payment_status' => 'pending',
            'required_documents' => json_encode($reviewedDocuments),
            'required_document_templates' => [],
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
            'internal_notes' => 'Private review note.',
        ], $adminHeaders)->assertOk()
            ->assertJsonFragment(['title' => 'Document needs changes']);

        $this->postJson('/api/franchise-applications/track', $trackingCredentials)->assertOk()
            ->assertJsonPath('data.required_documents.0.status', 'rejected')
            ->assertJsonPath('data.required_documents.0.reject_reason', 'Please provide a signed copy.')
            ->assertJsonMissingPath('data.admin_notes')
            ->assertJsonMissing(['Private review note.']);

        $this->post('/api/franchise-applications/track/documents', [
            ...$trackingCredentials,
            'required_document_uploads' => [
                0 => UploadedFile::fake()->create('corrected-one.pdf', 100, 'application/pdf'),
                1 => UploadedFile::fake()->create('corrected-two.pdf', 100, 'application/pdf'),
                2 => UploadedFile::fake()->create('corrected-three.pdf', 100, 'application/pdf'),
            ],
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.required_documents.0.status', 'submitted')
            ->assertJsonMissing(['Please provide a signed copy.']);

        $verifiedDocuments = $application->fresh()->required_documents;
        foreach ($verifiedDocuments as &$document) {
            $document['status'] = 'verified';
            $document['reject_reason'] = null;
        }
        unset($document);
        $this->post('/api/admin/franchise-applications/'.$application->id.'/requirements', [
            '_method' => 'PATCH',
            'agreement_status' => 'not_started',
            'agreement_prepared_at' => '',
            'agreement_signed_at' => '',
            'franchise_fee_amount' => '500000',
            'franchise_fee_payment_status' => 'pending',
            'required_documents' => json_encode($verifiedDocuments),
            'required_document_templates' => [],
            'location_readiness' => 'pending',
            'permit_compliance_status' => 'pending',
            'training_status' => 'pending',
            'operational_preparation_status' => 'pending',
            'internal_notes' => '',
        ], $adminHeaders)->assertOk()
            ->assertJsonPath('data.required_documents.0.status', 'verified')
            ->assertJsonFragment(['title' => 'Document verified']);

        $this->postJson('/api/franchise-applications/track', $trackingCredentials)->assertOk()
            ->assertJsonPath('data.required_documents.0.status', 'verified')
            ->assertJsonPath('data.required_documents.1.status', 'verified')
            ->assertJsonPath('data.required_documents.2.status', 'verified');

        $this->post('/api/franchise-applications/track/payment-proof', [
            ...$trackingCredentials,
            'payment_reference' => 'PAY-BAD',
            'proof' => UploadedFile::fake()->create('receipt.txt', 100, 'text/plain'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors('proof');

        $this->post('/api/franchise-applications/track/payment-proof', [
            ...$trackingCredentials,
            'payment_reference' => 'PAY-12345',
            'proof' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.franchise_fee_payment_status', 'submitted')
            ->assertJsonPath('data.franchise_fee_payment_reference', 'PAY-12345');

        $this->post('/api/franchise-applications/track/payment-proof', [
            ...$trackingCredentials,
            'email' => 'someone-else@example.test',
            'payment_reference' => 'PAY-OTHER',
            'proof' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertNotFound();
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
