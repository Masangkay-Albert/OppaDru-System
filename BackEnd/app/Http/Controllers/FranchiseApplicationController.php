<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Franchise;
use App\Models\FranchiseAccount;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Models\FranchiseUser;
use App\Models\SystemSetting;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class FranchiseApplicationController extends Controller
{
    use AdminAuthTrait;

    public function store(Request $request)
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'franchise_name' => 'nullable|string|max:255',
            'contact_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'required|string|max:50',
            'location' => 'required|string|max:2000',
            'applicant_address' => 'required|string|max:2000',
            'business_experience' => 'required|string|max:5000',
            'investment_capacity' => 'required|numeric|min:0|max:9999999999.99',
            'has_proposed_property' => 'required|boolean',
            'opening_timeline' => 'required|string|in:within_6_months,6_to_12_months,12_to_18_months,more_than_18_months,not_sure',
            'business_information' => 'nullable|string|max:5000',
            'notes' => 'nullable|string|max:5000',
            'documents' => 'nullable|array|max:8',
            'documents.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storedPaths = [];

        try {
            $application = DB::transaction(function () use ($request, $user, &$storedPaths) {
                $lockedUser = \App\Models\User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $hasOpenApplication = FranchiseApplication::query()
                    ->where('user_id', $lockedUser->id)
                    ->where(function ($query) {
                        $query->whereNull('status')
                            ->orWhereNotIn('status', ['rejected', 'withdrawn']);
                    })
                    ->exists();

                if ($hasOpenApplication) {
                    abort(response()->json([
                        'message' => 'You already have an application under review. You can follow its progress from My Applications.',
                    ], 409));
                }

                $location = trim((string) $request->input('location'));
                $application = FranchiseApplication::create([
                    'user_id' => $lockedUser->id,
                    'franchise_name' => trim((string) $request->input('franchise_name'))
                        ?: 'Oppa Dru - '.$location,
                    'contact_name' => trim((string) $request->input('contact_name')),
                    'email' => strtolower(trim((string) (
                        $request->filled('email') ? $request->input('email') : $lockedUser->email
                    ))),
                    'phone' => trim((string) $request->input('phone')),
                    'location' => $location,
                    'applicant_address' => trim((string) $request->input('applicant_address')),
                    'business_experience' => trim((string) $request->input('business_experience')),
                    'investment_capacity' => $request->input('investment_capacity'),
                    'has_proposed_property' => $request->boolean('has_proposed_property'),
                    'opening_timeline' => $request->input('opening_timeline'),
                    'business_information' => $request->input('business_information'),
                    'notes' => $request->input('notes'),
                    'status' => 'submitted',
                    'next_step_instructions' => 'Our franchise team will review your application and contact you using the contact email provided.',
                ]);

                $documents = [];
                foreach ($request->file('documents', []) as $file) {
                    $path = Storage::disk('local')->putFile('franchise-applications/'.$application->id, $file);
                    if (! $path) {
                        throw new RuntimeException('A supporting document could not be saved. Please try again.');
                    }
                    $storedPaths[] = $path;
                    $documents[] = [
                        'path' => $path,
                        'name' => basename($file->getClientOriginalName()),
                        'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(),
                        'uploaded_at' => now()->toIso8601String(),
                    ];
                }

                $application->documents = $documents;
                $application->save();

                $this->recordEvent(
                    $application,
                    'applicant',
                    $lockedUser->id,
                    'submitted',
                    'Application submitted',
                    'Your application was received and is waiting for review.',
                );

                return $application;
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('local')->delete($storedPaths);
            }
            throw $exception;
        }

        return response()->json([
            'data' => $application,
            'message' => 'Your application was submitted for review.',
            'reference_number' => $application->reference_number,
        ], 201);
    }

    public function opportunities()
    {
        $settings = SystemSetting::whereIn('key', [
            'franchise_investment_minimum',
            'franchise_investment_maximum',
        ])->pluck('value', 'key');

        $investment = [
            'minimum' => $settings->get('franchise_investment_minimum') !== '' ? $settings->get('franchise_investment_minimum') : null,
            'maximum' => $settings->get('franchise_investment_maximum') !== '' ? $settings->get('franchise_investment_maximum') : null,
        ];

        if ($investment['minimum'] === null && $investment['maximum'] === null) {
            $investment = null;
        }

        return response()->json([
            'data' => [
                'investment' => $investment,
                'requirements' => [
                    'A verified account and accurate applicant contact details.',
                    'Business or leadership experience relevant to operating a restaurant.',
                    'A realistic investment plan and willingness to complete the review process.',
                    'A proposed site, or readiness to work with the team to assess one.',
                    'Commitment to required training, permits, and operating standards before opening.',
                ],
                'steps' => [
                    'Submit your application and supporting information.',
                    'Application and financial-readiness review.',
                    'Follow-up information, interview, and proposed-location assessment as needed.',
                    'Conditional decision, agreement, and outstanding requirements.',
                    'Opening-readiness review and activation by an authorized administrator.',
                ],
                'faqs' => [
                    [
                        'question' => 'How long does the review take?',
                        'answer' => 'Timing depends on the completeness of your information and any required interview or location assessment. The team will provide updates in My Applications.',
                    ],
                    [
                        'question' => 'Do I need a property before applying?',
                        'answer' => 'No. Tell us whether you have a proposed property; the team can evaluate a site later in the process.',
                    ],
                    [
                        'question' => 'When can I operate a franchise?',
                        'answer' => 'Only after approval, applicable agreement and requirements, opening-readiness checks, and activation by an authorized administrator.',
                    ],
                ],
            ],
        ]);
    }

    public function updateOpportunitySettings(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'investment_minimum' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
            'investment_maximum' => 'sometimes|nullable|numeric|min:0|max:9999999999.99',
        ]);
        $validator->after(function ($validator) use ($request) {
            $minimum = $request->input('investment_minimum');
            $maximum = $request->input('investment_maximum');
            if (is_numeric($minimum) && is_numeric($maximum) && (float) $minimum > (float) $maximum) {
                $validator->errors()->add('investment_maximum', 'The maximum investment must be at least the minimum investment.');
            }
        });
        if ($validator->fails()) {
            return response()->json(['message' => 'Investment settings are invalid.', 'errors' => $validator->errors()], 422);
        }

        foreach ([
            'investment_minimum' => 'franchise_investment_minimum',
            'investment_maximum' => 'franchise_investment_maximum',
        ] as $field => $key) {
            if ($request->exists($field)) {
                $value = $request->input($field);
                SystemSetting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $value === null || $value === '' ? '' : number_format((float) $value, 2, '.', '')],
                );
            }
        }

        return $this->opportunities();
    }

    public function myApplications(Request $request)
    {
        return response()->json([
            'data' => FranchiseApplication::query()
                ->where('user_id', $request->user()->id)
                ->with(['events' => fn ($query) => $query->where('is_internal', false)])
                ->latest()
                ->get()
                ->map(fn (FranchiseApplication $application) => $this->applicantApplication($application))
                ->values(),
        ]);
    }

    public function showMine(Request $request, string $id)
    {
        $application = FranchiseApplication::query()
            ->where('user_id', $request->user()->id)
            ->with(['events' => fn ($query) => $query->where('is_internal', false)])
            ->findOrFail($id);

        return response()->json(['data' => $this->applicantApplication($application)]);
    }

    public function respond(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'response' => 'required|string|max:5000',
            'documents' => 'nullable|array|max:8',
            'documents.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Your response could not be submitted.', 'errors' => $validator->errors()], 422);
        }

        $userId = $request->user()->id;
        $storedPaths = [];
        try {
            $application = DB::transaction(function () use ($request, $id, $userId, &$storedPaths) {
                $application = FranchiseApplication::where('user_id', $userId)
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->firstOrFail();
                if ($application->status !== 'additional_information_required') {
                    abort(response()->json(['message' => 'A response can only be sent when additional information has been requested.'], 409));
                }

                $documents = $application->documents ?? [];
                foreach ($request->file('documents', []) as $file) {
                    $path = Storage::disk('local')->putFile('franchise-applications/'.$application->id, $file);
                    if (! $path) {
                        throw new RuntimeException('A supporting document could not be saved. Please try again.');
                    }
                    $storedPaths[] = $path;
                    $documents[] = [
                        'path' => $path,
                        'name' => basename($file->getClientOriginalName()),
                        'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(),
                        'uploaded_at' => now()->toIso8601String(),
                    ];
                }

                $application->documents = $documents;
                $application->save();
                $this->recordEvent(
                    $application,
                    'applicant',
                    $userId,
                    $application->status,
                    'Additional information submitted',
                    trim((string) $request->input('response')),
                );

                return $application->fresh(['events' => fn ($query) => $query->where('is_internal', false)]);
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('local')->delete($storedPaths);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Your response has been sent to the franchise review team.',
            'data' => $this->applicantApplication($application),
        ]);
    }

    public function withdraw(Request $request, string $id)
    {
        $userId = $request->user()->id;
        DB::transaction(function () use ($userId, $id) {
            $application = FranchiseApplication::where('user_id', $userId)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            if (! in_array($application->status, [
                'submitted',
                'pending',
                'under_review',
                'additional_information_required',
                'for_interview',
                'location_assessment',
                'on_hold',
            ], true)) {
                abort(response()->json(['message' => 'This application can no longer be withdrawn at its current stage.'], 409));
            }

            $application->status = 'withdrawn';
            $application->next_step_instructions = 'This application has been withdrawn. Contact the franchise team if you need help.';
            $application->save();
            $this->recordEvent(
                $application,
                'applicant',
                $userId,
                'withdrawn',
                'Application withdrawn',
                'You withdrew this application.',
            );
        });

        return response()->json(['message' => 'Your application has been withdrawn.']);
    }

    public function downloadDocument(Request $request, string $id, int $document)
    {
        $application = FranchiseApplication::findOrFail($id);
        $isApplicant = (string) $request->user()?->id === (string) $application->user_id;
        if (! $isApplicant && ! $this->checkAdminAuth($request)) {
            abort(404);
        }

        $file = $application->documents[$document] ?? null;
        if (! is_array($file) || empty($file['path']) || ! Storage::disk('local')->exists($file['path'])) {
            abort(404);
        }

        return Storage::disk('local')->download($file['path'], $file['name'] ?? 'supporting-document');
    }

    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => FranchiseApplication::with(['applicant:id,full_name,email'])
                ->orderBy('created_at', 'desc')
                ->get(),
        ]);
    }

    public function showAdmin(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = FranchiseApplication::with(['applicant:id,full_name,email', 'events'])
            ->findOrFail($id);

        return response()->json(['data' => $application]);
    }

    public function review(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:'.implode(',', array_diff(FranchiseApplication::STATUSES, ['active', 'withdrawn'])),
            'admin_notes' => 'nullable|string|max:5000',
            'next_step_instructions' => 'nullable|string|max:2000',
            'interview_at' => 'nullable|date',
            'interview_notes' => 'nullable|string|max:5000',
            'location_assessment.result' => 'nullable|string|in:pending,passed,follow_up_required,not_suitable',
            'location_assessment.notes' => 'nullable|string|max:5000',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Review details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $targetStatus = $request->input('status');
        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $application = DB::transaction(function () use ($id, $request, $targetStatus, $admin) {
            $application = FranchiseApplication::whereKey($id)->lockForUpdate()->firstOrFail();
            $currentStatus = $application->status === 'pending' ? 'submitted' : $application->status;
            if (! $this->canTransition($currentStatus, $targetStatus)) {
                abort(response()->json([
                    'message' => "The application cannot move from {$currentStatus} to {$targetStatus}.",
                ], 409));
            }
            if ($targetStatus === 'additional_information_required' && ! $request->filled('next_step_instructions')) {
                abort(response()->json(['message' => 'Provide clear instructions for the additional information required.'], 422));
            }
            if ($targetStatus === 'for_interview' && ! $request->filled('interview_at')) {
                abort(response()->json(['message' => 'Set an interview date and time before moving this application to For Interview.'], 422));
            }

            $application->status = $targetStatus;
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            if ($request->has('next_step_instructions')) {
                $application->next_step_instructions = $request->input('next_step_instructions');
            }
            if ($request->has('interview_at')) {
                $application->interview_at = $request->input('interview_at');
                $application->interview_notes = $request->input('interview_notes');
            }
            if ($request->has('location_assessment')) {
                $application->location_assessment = $request->input('location_assessment');
            }
            if ($request->filled('admin_notes')) {
                $application->admin_notes = trim(implode("\n\n", array_filter([
                    $application->admin_notes,
                    '['.now()->toDateTimeString().'] '.$request->input('admin_notes'),
                ])));
            }
            $application->save();

            $this->recordEvent(
                $application,
                'admin',
                $admin?->id,
                $targetStatus,
                'Status updated',
                $application->next_step_instructions ?: 'Your application status was updated.',
            );

            if ($request->filled('admin_notes')) {
                $this->recordEvent($application, 'admin', $admin?->id, $targetStatus, 'Internal review note added', $request->input('admin_notes'), true);
            }
            if ($request->filled('interview_at')) {
                $this->recordEvent(
                    $application,
                    'admin',
                    $admin?->id,
                    $targetStatus,
                    'Interview scheduled',
                    'Interview scheduled for '.date('F j, Y g:i A', strtotime((string) $request->input('interview_at'))).'.',
                );
                if ($request->filled('interview_notes')) {
                    $this->recordEvent($application, 'admin', $admin?->id, $targetStatus, 'Interview notes added', $request->input('interview_notes'), true);
                }
            }
            if ($request->filled('location_assessment.notes')) {
                $this->recordEvent($application, 'admin', $admin?->id, $targetStatus, 'Location assessment recorded', $request->input('location_assessment.notes'), true);
            }

            return $application->fresh(['events']);
        });

        return response()->json([
            'message' => 'Application review updated.',
            'data' => $application,
        ]);
    }

    public function updateRequirements(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'agreement_status' => 'required|string|in:not_started,drafting,sent,signed',
            'agreement_prepared_at' => 'nullable|date',
            'agreement_signed_at' => 'nullable|date',
            'franchise_fee_amount' => 'nullable|numeric|min:0|max:9999999999.99',
            'franchise_fee_payment_status' => 'required|string|in:not_configured,pending,paid,waived,not_applicable',
            'franchise_fee_payment_reference' => 'nullable|string|max:255',
            'required_documents' => 'present|array|max:30',
            'required_documents.*.label' => 'required|string|max:255',
            'required_documents.*.required' => 'required|boolean',
            'required_documents.*.status' => 'required|string|in:pending,received,verified,not_applicable',
            'location_readiness' => 'required|string|in:pending,ready,not_applicable',
            'permit_compliance_status' => 'required|string|in:pending,verified,not_applicable',
            'training_status' => 'required|string|in:pending,scheduled,complete,not_applicable',
            'operational_preparation_status' => 'required|string|in:pending,in_progress,complete,not_applicable',
            'internal_notes' => 'nullable|string|max:5000',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Agreement and requirement details are invalid.', 'errors' => $validator->errors()], 422);
        }

        $feeStatus = $request->input('franchise_fee_payment_status');
        if ($feeStatus === 'paid' && (! $request->filled('franchise_fee_amount') || ! $request->filled('franchise_fee_payment_reference'))) {
            return response()->json(['message' => 'Record the applicable fee amount and payment reference before marking it paid.'], 422);
        }
        if (in_array($feeStatus, ['waived', 'not_applicable'], true) && ! $request->filled('internal_notes')) {
            return response()->json(['message' => 'Explain the fee waiver or why no franchise fee applies.'], 422);
        }
        if (in_array($request->input('agreement_status'), ['drafting', 'sent', 'signed'], true) && ! $request->filled('agreement_prepared_at')) {
            return response()->json(['message' => 'Record the actual agreement preparation date.'], 422);
        }
        if ($request->input('agreement_status') === 'signed' && ! $request->filled('agreement_signed_at')) {
            return response()->json(['message' => 'Record the actual agreement signing date before marking it signed.'], 422);
        }

        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $application = DB::transaction(function () use ($id, $request, $admin) {
            $application = FranchiseApplication::whereKey($id)->lockForUpdate()->firstOrFail();
            if (! in_array($application->status, [
                'conditionally_approved',
                'agreement_pending',
                'requirements_pending',
                'approved_for_opening',
            ], true)) {
                abort(response()->json(['message' => 'Agreement and opening requirements can only be tracked after conditional approval.'], 409));
            }

            foreach ([
                'agreement_status',
                'agreement_prepared_at',
                'agreement_signed_at',
                'franchise_fee_amount',
                'franchise_fee_payment_status',
                'franchise_fee_payment_reference',
                'required_documents',
                'location_readiness',
                'permit_compliance_status',
                'training_status',
                'operational_preparation_status',
            ] as $field) {
                $application->{$field} = $request->input($field);
            }
            $application->requirements_reviewed_at = now();
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            if ($application->status === 'conditionally_approved') {
                $application->status = 'agreement_pending';
            }
            $application->save();

            $this->recordEvent(
                $application,
                'admin',
                $admin?->id,
                $application->status,
                'Agreement and opening requirements updated',
                'Your agreement and opening requirements were updated by the franchise team.',
            );
            if ($request->filled('internal_notes')) {
                $this->recordEvent(
                    $application,
                    'admin',
                    $admin?->id,
                    $application->status,
                    'Internal requirements note added',
                    $request->input('internal_notes'),
                    true,
                );
            }

            return $application->fresh(['events']);
        });

        return response()->json([
            'message' => 'Agreement and opening requirements saved.',
            'data' => $application,
        ]);
    }

    public function activate(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = FranchiseApplication::findOrFail($id);
        if ($application->status === 'active' || $application->franchise_id || $application->franchise_account_id) {
            return response()->json([
                'message' => 'This application is already associated with an activated franchise.',
                'data' => [
                    'franchise_id' => $application->franchise_id,
                    'franchise_account_id' => $application->franchise_account_id,
                ],
            ], 409);
        }
        if ($application->status !== 'approved_for_opening') {
            return response()->json(['message' => 'Only an application approved for opening can be activated.'], 409);
        }

        $validator = Validator::make($request->all(), [
            'manager_full_name' => 'required|string|max:255',
            'manager_email' => 'required|string|email|max:255|unique:franchise_users,email',
            'manager_phone' => 'nullable|string|max:50',
            'manager_password' => 'required|string|min:12|max:255',
            'can_process_pos' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'A unique manager account and secure initial password are required.', 'errors' => $validator->errors()], 422);
        }

        $issues = $this->activationReadinessIssues($application);
        if ($issues !== []) {
            return response()->json([
                'message' => 'The franchise is not ready for activation. Complete or explicitly mark every applicable requirement before continuing.',
                'requirements' => $issues,
            ], 409);
        }

        $admin = Admin::where('api_token', hash('sha256', $request->bearerToken() ?? ''))->first();
        $activated = DB::transaction(function () use ($id, $request, $admin) {
            $application = FranchiseApplication::whereKey($id)->lockForUpdate()->firstOrFail();

            if ($application->status === 'active' || $application->franchise_id || $application->franchise_account_id) {
                abort(response()->json([
                    'message' => 'This application is already associated with an activated franchise.',
                    'data' => [
                        'franchise_id' => $application->franchise_id,
                        'franchise_account_id' => $application->franchise_account_id,
                    ],
                ], 409));
            }
            if ($application->status !== 'approved_for_opening') {
                abort(response()->json(['message' => 'The application must be approved for opening before activation.'], 409));
            }

            $issues = $this->activationReadinessIssues($application);
            if ($issues !== []) {
                abort(response()->json([
                    'message' => 'The franchise is not ready for activation.',
                    'requirements' => $issues,
                ], 409));
            }

            $name = trim($application->franchise_name) ?: 'Oppa Dru Franchise';
            $accountSlug = $this->uniqueSlug($name, FranchiseAccount::class);
            $locationSlug = $this->uniqueSlug($name.' '.$application->location, Franchise::class);
            $account = FranchiseAccount::create([
                'name' => $name,
                'slug' => $accountSlug,
                'email' => $application->email,
                'phone' => $application->phone,
                'address' => $application->applicant_address,
                'status' => 'active',
                'owner_admin_id' => $admin?->id,
                'metadata' => [
                    'application_id' => $application->id,
                    'application_reference' => $application->reference_number,
                ],
            ]);
            $location = Franchise::create([
                'franchise_account_id' => $account->id,
                'name' => $name,
                'slug' => $locationSlug,
                'email' => $application->email,
                'phone' => $application->phone,
                'address' => $application->location,
                'status' => 'active',
                'owner_admin_id' => $admin?->id,
                'metadata' => [
                    'application_id' => $application->id,
                    'application_reference' => $application->reference_number,
                    'proposed_location' => $application->location,
                ],
            ]);
            $manager = FranchiseUser::create([
                'franchise_account_id' => $account->id,
                'franchise_id' => $location->id,
                'full_name' => trim((string) $request->input('manager_full_name')),
                'email' => strtolower(trim((string) $request->input('manager_email'))),
                'phone' => $request->input('manager_phone'),
                'password' => Hash::make((string) $request->input('manager_password')),
                'is_active' => true,
                'can_process_pos' => $request->boolean('can_process_pos'),
            ]);

            $application->franchise_account_id = $account->id;
            $application->franchise_id = $location->id;
            $application->status = 'active';
            $application->activated_at = now();
            $application->activated_by_admin_id = $admin?->id;
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            $application->next_step_instructions = 'Your franchise is active. Sign in to the franchise portal using the manager credentials provided by your administrator, then configure authorized staff and cashiers for this location.';
            $application->save();

            $this->recordEvent(
                $application,
                'admin',
                $admin?->id,
                'active',
                'Franchise activated',
                'Your franchise has been activated. Follow the administrator’s instructions to access the franchise portal and complete operational setup.',
            );

            return $application->fresh(['events', 'franchiseAccount', 'franchise']);
        });

        return response()->json([
            'message' => 'Franchise activated and manager access configured.',
            'data' => $activated,
        ], 201);
    }

    public function stats(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => [
                'total_applications' => FranchiseApplication::count(),
                'pending_applications' => FranchiseApplication::where(function ($query) {
                    $query->whereNull('status')
                        ->orWhereIn('status', [
                            'pending',
                            'submitted',
                            'under_review',
                            'additional_information_required',
                            'for_interview',
                            'location_assessment',
                            'conditionally_approved',
                            'agreement_pending',
                            'requirements_pending',
                            'approved_for_opening',
                            'on_hold',
                        ]);
                })->count(),
                'approved_applications' => FranchiseApplication::whereIn('status', [
                    'approved',
                    'conditionally_approved',
                    'agreement_pending',
                    'requirements_pending',
                    'approved_for_opening',
                    'active',
                ])->count(),
                'rejected_applications' => FranchiseApplication::where('status', 'rejected')->count(),
                'recent_applications' => FranchiseApplication::orderBy('created_at', 'desc')->limit(10)->get(),
            ],
        ]);
    }

    private function canTransition(string $current, string $target): bool
    {
        if ($current === $target && ! in_array($current, ['active', 'rejected', 'withdrawn'], true)) {
            return true;
        }

        $transitions = [
            'submitted' => ['under_review', 'on_hold', 'rejected'],
            'pending' => ['under_review', 'on_hold', 'rejected'],
            'under_review' => ['additional_information_required', 'for_interview', 'location_assessment', 'conditionally_approved', 'on_hold', 'rejected'],
            'additional_information_required' => ['under_review', 'on_hold', 'rejected'],
            'for_interview' => ['under_review', 'location_assessment', 'conditionally_approved', 'on_hold', 'rejected'],
            'location_assessment' => ['under_review', 'conditionally_approved', 'on_hold', 'rejected'],
            'conditionally_approved' => ['agreement_pending', 'requirements_pending', 'on_hold', 'rejected'],
            'agreement_pending' => ['requirements_pending', 'on_hold', 'rejected'],
            'requirements_pending' => ['agreement_pending', 'approved_for_opening', 'on_hold', 'rejected'],
            'approved_for_opening' => ['requirements_pending', 'on_hold'],
            'on_hold' => ['under_review', 'for_interview', 'location_assessment', 'conditionally_approved', 'agreement_pending', 'requirements_pending', 'approved_for_opening', 'rejected'],
        ];

        return in_array($target, $transitions[$current] ?? [], true);
    }

    private function activationReadinessIssues(FranchiseApplication $application): array
    {
        $issues = [];
        if ($application->agreement_status !== 'signed' || ! $application->agreement_signed_at) {
            $issues[] = 'The franchise agreement must be recorded as signed with its actual signing date.';
        }
        if (! in_array($application->franchise_fee_payment_status, ['paid', 'waived', 'not_applicable'], true)) {
            $issues[] = 'The applicable franchise fee must be paid, waived with a recorded reason, or explicitly marked not applicable.';
        }
        if ($application->franchise_fee_payment_status === 'paid'
            && (! $application->franchise_fee_amount || ! $application->franchise_fee_payment_reference)) {
            $issues[] = 'The paid franchise fee must include its amount and payment reference.';
        }
        if (! $application->requirements_reviewed_at) {
            $issues[] = 'An administrator must review and save the requirements checklist.';
        }
        foreach ($application->required_documents ?? [] as $document) {
            if (($document['required'] ?? false) && ! in_array($document['status'] ?? null, ['verified', 'not_applicable'], true)) {
                $issues[] = 'Required document not verified: '.($document['label'] ?? 'Unnamed document').'.';
            }
        }
        if (! in_array($application->location_readiness, ['ready', 'not_applicable'], true)) {
            $issues[] = 'Location readiness must be confirmed or explicitly marked not applicable.';
        }
        if (! in_array($application->permit_compliance_status, ['verified', 'not_applicable'], true)) {
            $issues[] = 'Permit and compliance checks must be verified or explicitly marked not applicable.';
        }
        if (! in_array($application->training_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Required training must be complete or explicitly marked not applicable.';
        }
        if (! in_array($application->operational_preparation_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Operational preparation must be complete or explicitly marked not applicable.';
        }

        return $issues;
    }

    private function uniqueSlug(string $name, string $modelClass): string
    {
        $base = Str::slug($name) ?: 'franchise';
        $slug = $base;
        $suffix = 2;
        while ($modelClass::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    private function recordEvent(
        FranchiseApplication $application,
        string $actorType,
        string|int|null $actorId,
        ?string $status,
        string $title,
        ?string $message,
        bool $internal = false,
    ): void {
        FranchiseApplicationEvent::create([
            'application_id' => $application->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId === null ? null : (string) $actorId,
            'status' => $status,
            'title' => $title,
            'message' => $message,
            'is_internal' => $internal,
            'created_at' => now(),
        ]);
    }

    private function applicantApplication(FranchiseApplication $application): array
    {
        $application->makeHidden([
            'user_id',
            'admin_notes',
            'reviewed_by_admin_id',
            'reviewed_at',
            'interview_notes',
            'location_assessment',
        ]);
        $application->documents = collect($application->documents ?? [])
            ->map(fn (array $document) => collect($document)->only(['name', 'mime_type', 'size', 'uploaded_at'])->all())
            ->all();

        return $application->toArray();
    }
}
