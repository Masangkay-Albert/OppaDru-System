<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use RuntimeException;
use Throwable;

trait FranchiseApplicationApplicantActions
{
    public function store(Request $request)
    {
        $applicant = $request->user();
        $validator = Validator::make($request->all(), [
            'franchise_name' => 'nullable|string|max:255',
            'contact_name' => 'required|string|max:255',
            'phone' => ['required', 'string', 'max:50', 'regex:/^09\d{2}\s?\d{3}\s?\d{4}$/'],
            'update_profile' => 'nullable|boolean',
            'location' => 'required|string|max:2000',
            'applicant_address' => 'required|string|max:2000',
            'business_experience' => 'required|string|max:5000',
            'investment_capacity' => 'required|numeric|min:0|max:9999999999.99',
            'has_proposed_property' => 'required|boolean',
            'property_status' => 'nullable|string|in:yes,no,looking',
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
            $application = DB::transaction(function () use ($request, $applicant, &$storedPaths) {
                $lockedApplicant = FranchiseApplicant::whereKey($applicant->id)->lockForUpdate()->firstOrFail();
                $email = strtolower(trim((string) $lockedApplicant->email));
                $phone = preg_replace('/\D+/', '', (string) $request->input('phone'));
                if ($request->boolean('update_profile')) {
                    $lockedApplicant->full_name = trim((string) $request->input('contact_name'));
                    $lockedApplicant->phone = $phone;
                    $lockedApplicant->save();
                }
                $hasOpenApplication = FranchiseApplication::query()
                    ->where(function ($query) use ($lockedApplicant, $email) {
                        $query->where('franchise_applicant_id', $lockedApplicant->id)
                            ->orWhere('email', $email);
                    })
                    ->where(function ($query) {
                        $query->whereNull('status')
                            ->orWhereNotIn('status', ['rejected', 'withdrawn']);
                    })
                    ->exists();

                if ($hasOpenApplication) {
                    abort(response()->json([
                        'message' => 'An application using this applicant account or contact email is already in progress. Contact the franchise team if you need help with it.',
                    ], 409));
                }

                $location = trim((string) $request->input('location'));
                $propertyStatus = $request->input('property_status')
                    ?: ($request->boolean('has_proposed_property') ? 'yes' : 'no');
                $application = FranchiseApplication::create([
                    'franchise_applicant_id' => $lockedApplicant->id,
                    'franchise_name' => trim((string) $request->input('franchise_name'))
                        ?: 'Oppa Dru - '.$location,
                    'contact_name' => trim((string) $request->input('contact_name')),
                    'email' => $email,
                    'phone' => $phone,
                    'location' => $location,
                    'applicant_address' => trim((string) $request->input('applicant_address')),
                    'business_experience' => trim((string) $request->input('business_experience')),
                    'investment_capacity' => $request->input('investment_capacity'),
                    'has_proposed_property' => $propertyStatus === 'yes',
                    'property_status' => $propertyStatus,
                    'opening_timeline' => $request->input('opening_timeline'),
                    'business_information' => $request->input('business_information'),
                    'notes' => $request->input('notes'),
                    'status' => 'under_review',
                    'next_step_instructions' => FranchiseApplication::defaultInstructionsFor('under_review'),
                ]);

                $documents = [];
                foreach ($request->file('documents', []) as $file) {
                    $path = Storage::disk()->putFile('franchise-applications/'.$application->id, $file);
                    if (! $path) {
                        throw new RuntimeException('A supporting document could not be saved. Please try again.');
                    }
                    $storedPaths[] = $path;
                    $documents[] = [
                        'path' => $path,
                        'disk' => config('filesystems.default'),
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
                    $lockedApplicant->id,
                    'under_review',
                    'Application submitted',
                    'Your application was received and is now under review.',
                );

                return $application;
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk()->delete($storedPaths);
            }
            throw $exception;
        }

        return response()->json([
            'data' => $this->applicantApplication($application),
            'message' => 'Your application was submitted and is now under review.',
            'reference_number' => $application->reference_number,
        ], 201);
    }

    public function myApplications(Request $request)
    {
        return response()->json([
            'data' => FranchiseApplication::query()
                ->where('franchise_applicant_id', $request->user()->id)
                ->with(['events' => fn ($query) => $query->where('is_internal', false)])
                ->latest()
                ->get()
                ->map(fn (FranchiseApplication $application) => $this->applicantApplication($application))
                ->values(),
        ]);
    }

    public function trackByReference(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reference_number' => 'required|string|max:32',
            'email' => 'required|email|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Enter the application reference number and contact email used when applying.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $application = FranchiseApplication::query()
            ->whereRaw('LOWER(reference_number) = ?', [strtolower(trim((string) $request->input('reference_number')))])
            ->whereRaw('LOWER(email) = ?', [strtolower(trim((string) $request->input('email')))])
            ->with(['events' => fn ($query) => $query->where('is_internal', false)])
            ->first();

        if (! $application) {
            return response()->json([
                'message' => 'We could not find an application matching those details. Check your reference number and contact email.',
            ], 404);
        }

        return response()->json(['data' => $this->applicantApplication($application)]);
    }

    public function showMine(Request $request, string $id)
    {
        $application = FranchiseApplication::query()
            ->where('franchise_applicant_id', $request->user()->id)
            ->with(['events' => fn ($query) => $query->where('is_internal', false)])
            ->findOrFail($id);

        return response()->json(['data' => $this->applicantApplication($application)]);
    }

    public function respond(Request $request, string $id = '')
    {
        foreach (['documents', 'required_document_uploads'] as $field) {
            foreach ($request->file($field, []) as $index => $file) {
                if (! $file instanceof UploadedFile || $file->isValid()) {
                    continue;
                }

                $message = match ($file->getError()) {
                    UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'One of your files exceeds the server upload limit. Each file must be 10 MB or smaller.',
                    UPLOAD_ERR_PARTIAL => 'One of your files was only partially uploaded. Please select it again and retry.',
                    UPLOAD_ERR_NO_TMP_DIR => 'The server could not prepare the upload. Please try again later.',
                    UPLOAD_ERR_CANT_WRITE => 'The server could not receive the upload. Please try again later.',
                    UPLOAD_ERR_EXTENSION => 'The server stopped one of your uploads. Please contact support if this continues.',
                    default => 'One of your files could not be uploaded. Please select it again and retry.',
                };

                return response()->json([
                    'message' => $message,
                    'errors' => ["{$field}.{$index}" => [$message]],
                ], 422);
            }
        }

        $validator = Validator::make($request->all(), [
            'response' => 'nullable|string|max:5000',
            'reference_number' => [$request->user() ? 'nullable' : 'required', 'string', 'max:32'],
            'email' => [$request->user() ? 'nullable' : 'required', 'email', 'max:255'],
            'documents' => 'nullable|array|max:8',
            'documents.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
            'required_document_uploads' => 'nullable|array|max:8',
            'required_document_uploads.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Your response could not be submitted.', 'errors' => $validator->errors()], 422);
        }

        $applicantId = $request->user()?->id;
        $referenceNumber = strtolower(trim((string) $request->input('reference_number')));
        $contactEmail = strtolower(trim((string) $request->input('email')));
        $uploadedCount = count($request->file('documents', [])) + count($request->file('required_document_uploads', []));
        if ($uploadedCount > 8) {
            return response()->json(['message' => 'Submit no more than 8 documents in one response.'], 422);
        }
        $storedPaths = [];
        try {
            $application = DB::transaction(function () use ($request, $id, $applicantId, $referenceNumber, $contactEmail, &$storedPaths) {
                $applicationQuery = FranchiseApplication::query()->lockForUpdate();
                if ($applicantId !== null) {
                    $applicationQuery->where('franchise_applicant_id', $applicantId)->whereKey($id);
                } else {
                    $applicationQuery
                        ->whereRaw('LOWER(reference_number) = ?', [$referenceNumber])
                        ->whereRaw('LOWER(email) = ?', [$contactEmail]);
                }
                $application = $applicationQuery->firstOrFail();
                $documents = $application->documents ?? [];
                $requiredDocuments = $application->required_documents ?? [];
                $hasConfirmedPacket = (bool) $application->required_documents_confirmed_at;
                $latestPacketRequestId = FranchiseApplicationEvent::query()
                    ->where('application_id', $application->id)
                    ->where('title', 'Document packet requested')
                    ->orderByDesc('id')
                    ->value('id');
                $latestPacketSubmissionId = FranchiseApplicationEvent::query()
                    ->where('application_id', $application->id)
                    ->whereIn('title', ['Additional information submitted', 'Document packet submitted', 'Documents submitted'])
                    ->orderByDesc('id')
                    ->value('id');
                $hasOpenPacketRequest = $hasConfirmedPacket
                    && $latestPacketRequestId
                    && (! $latestPacketSubmissionId || $latestPacketRequestId > $latestPacketSubmissionId);
                $hasConfiguredRequirements = collect($requiredDocuments)
                    ->contains(fn (array $document) => ($document['required'] ?? false)
                        && ($document['status'] ?? null) !== 'not_applicable');
                $isLocationAssessment = $application->status === 'location_assessment'
                    && $hasConfiguredRequirements
                    && $hasOpenPacketRequest;
                if ($application->status !== 'additional_information_required'
                    && ! $hasOpenPacketRequest
                    && ! $isLocationAssessment) {
                    abort(response()->json(['message' => 'A document packet can only be submitted after the franchise team confirms and requests it.'], 409));
                }
                $requestedForCombinedReview = (bool) $hasOpenPacketRequest;
                if ($requestedForCombinedReview && ! $hasConfiguredRequirements) {
                    abort(response()->json(['message' => 'The franchise team has not configured any required documents yet.'], 409));
                }
                $requiredUploads = $request->file('required_document_uploads', []);
                if ($requestedForCombinedReview) {
                    $missingDocuments = [];
                    foreach ($requiredDocuments as $index => $requiredDocument) {
                        if (($requiredDocument['required'] ?? false)
                            && ! in_array($requiredDocument['status'] ?? null, ['verified', 'not_applicable'], true)
                            && empty($requiredUploads[$index])) {
                            $missingDocuments[] = $requiredDocument['label'] ?? 'Required document';
                        }
                    }
                    if ($missingDocuments !== []) {
                        abort(response()->json([
                            'message' => 'Upload every required document together before submitting.',
                            'missing_documents' => $missingDocuments,
                        ], 422));
                    }
                }

                $uploadGroups = [
                    ['files' => $request->file('documents', []), 'requirement_index' => null],
                ];
                foreach ($requiredUploads as $requirementIndex => $file) {
                    $uploadGroups[] = ['files' => [$file], 'requirement_index' => (int) $requirementIndex];
                }
                foreach ($uploadGroups as $group) {
                    foreach ($group['files'] as $file) {
                        $path = Storage::disk()->putFile('franchise-applications/'.$application->id, $file);
                        if (! $path) {
                            throw new RuntimeException('A supporting document could not be saved. Please try again.');
                        }
                        $storedPaths[] = $path;
                        $storedDocument = [
                            'path' => $path,
                            'disk' => config('filesystems.default'),
                            'name' => basename($file->getClientOriginalName()),
                            'mime_type' => $file->getMimeType(),
                            'size' => $file->getSize(),
                            'uploaded_at' => now()->toIso8601String(),
                        ];
                        if ($group['requirement_index'] !== null) {
                            $requirementIndex = $group['requirement_index'];
                            if (! isset($requiredDocuments[$requirementIndex])) {
                                abort(response()->json(['message' => 'One of the selected document requirements is no longer available. Refresh and try again.'], 409));
                            }
                            $storedDocument['required_document_index'] = $requirementIndex;
                            $storedDocument['required_document_label'] = $requiredDocuments[$requirementIndex]['label'];
                            $requiredDocuments[$requirementIndex]['status'] = 'submitted';
                            unset($requiredDocuments[$requirementIndex]['reject_reason']);
                            $requiredDocuments[$requirementIndex]['submitted_document_name'] = $storedDocument['name'];
                            $requiredDocuments[$requirementIndex]['submitted_document_index'] = count($documents);
                        }
                        $documents[] = $storedDocument;
                    }
                }

                $application->documents = $documents;
                $application->required_documents = $requiredDocuments;
                $previousReviewStatus = FranchiseApplicationEvent::query()
                    ->where('application_id', $application->id)
                    ->where('title', 'Status updated')
                    ->where('status', '!=', 'additional_information_required')
                    ->orderByDesc('id')
                    ->value('status');
                $application->status = $previousReviewStatus === 'location_assessment' ? 'location_assessment' : 'under_review';
                $application->next_step_instructions = $application->status === 'location_assessment'
                    ? 'Your complete document packet was received. The franchise team will continue the site assessment and final review.'
                    : 'Your response was received. The franchise team will review the information you provided.';
                $application->save();
                $this->recordEvent(
                    $application,
                    'applicant',
                    $applicantId,
                    $application->status,
                    $hasOpenPacketRequest || $isLocationAssessment ? 'Documents submitted' : 'Additional information submitted',
                    trim((string) $request->input('response'))
                        ?: 'The applicant submitted the requested document packet.',
                );

                return $application->fresh(['events' => fn ($query) => $query->where('is_internal', false)]);
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk()->delete($storedPaths);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Your response has been sent to the franchise review team.',
            'data' => $this->applicantApplication($application),
        ]);
    }

    public function downloadRequiredDocumentTemplate(Request $request, string $id, int $document)
    {
        $application = FranchiseApplication::query()
            ->where('franchise_applicant_id', $request->user()->id)
            ->findOrFail($id);
        if (! $this->hasConfirmedDocumentPacketRequest($application)) {
            abort(404);
        }
        $requiredDocument = $application->required_documents[$document] ?? null;
        if (! is_array($requiredDocument)
            || empty($requiredDocument['template_path'])
            || ! Storage::disk('local')->exists($requiredDocument['template_path'])) {
            abort(404);
        }

        $stream = Storage::disk('local')->readStream($requiredDocument['template_path']);
        if (! is_resource($stream)) {
            abort(404);
        }

        return response()->streamDownload(
            function () use ($stream): void {
                try {
                    fpassthru($stream);
                } finally {
                    fclose($stream);
                }
            },
            $requiredDocument['template_name'] ?? 'required-document-template',
            ['Content-Type' => 'application/octet-stream'],
        );
    }

    public function downloadTrackedRequiredDocumentTemplate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reference_number' => 'required|string|max:32',
            'email' => 'required|email|max:255',
            'document' => 'required|integer|min:0|max:7',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Enter your application reference and contact email.', 'errors' => $validator->errors()], 422);
        }

        $application = FranchiseApplication::query()
            ->whereRaw('LOWER(reference_number) = ?', [strtolower(trim((string) $request->input('reference_number')))])
            ->whereRaw('LOWER(email) = ?', [strtolower(trim((string) $request->input('email')))])
            ->firstOrFail();
        if (! $this->hasConfirmedDocumentPacketRequest($application)) {
            abort(404);
        }
        $requiredDocument = $application->required_documents[$request->integer('document')] ?? null;
        if (! is_array($requiredDocument)
            || empty($requiredDocument['template_path'])
            || ! Storage::disk('local')->exists($requiredDocument['template_path'])) {
            abort(404);
        }

        $stream = Storage::disk('local')->readStream($requiredDocument['template_path']);
        if (! is_resource($stream)) {
            abort(404);
        }

        return response()->streamDownload(
            function () use ($stream): void {
                try {
                    fpassthru($stream);
                } finally {
                    fclose($stream);
                }
            },
            $requiredDocument['template_name'] ?? 'required-document-template',
            ['Content-Type' => 'application/octet-stream'],
        );
    }

    public function submitPaymentProof(Request $request, string $id = '')
    {
        $validator = Validator::make($request->all(), [
            'reference_number' => [$request->user() ? 'nullable' : 'required', 'string', 'max:32'],
            'email' => [$request->user() ? 'nullable' : 'required', 'email', 'max:255'],
            'payment_reference' => 'nullable|string|max:255',
            'proof' => 'required|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);
        $validator->after(function ($validator) use ($request) {
            if (! $request->user() && ! trim((string) $request->input('payment_reference'))) {
                $validator->errors()->add('payment_reference', 'Enter your payment reference number.');
            }
        });
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Enter a payment reference and upload a JPG, PNG, WEBP, or PDF proof up to 5 MB.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $applicantId = $request->user()?->id;
        $referenceNumber = strtolower(trim((string) $request->input('reference_number')));
        $contactEmail = strtolower(trim((string) $request->input('email')));
        $file = $request->file('proof');
        $storedPath = null;
        $replacedPath = null;
        $replacedDisk = 'local';

        try {
            $application = DB::transaction(function () use ($applicantId, $file, $id, $referenceNumber, $contactEmail, $request, &$storedPath, &$replacedPath, &$replacedDisk) {
                $applicationQuery = FranchiseApplication::query()->lockForUpdate();
                if ($applicantId !== null) {
                    $applicationQuery->where('franchise_applicant_id', $applicantId)->whereKey($id);
                } else {
                    $applicationQuery
                        ->whereRaw('LOWER(reference_number) = ?', [$referenceNumber])
                        ->whereRaw('LOWER(email) = ?', [$contactEmail]);
                }
                $application = $applicationQuery->firstOrFail();
                if (! in_array($application->franchise_fee_payment_status, ['pending', 'rejected'], true)
                    || ! $application->franchise_fee_amount
                    || ! in_array($application->status, [
                        'location_assessment',
                        'conditionally_approved',
                        'agreement_pending',
                        'requirements_pending',
                        'approved_for_opening',
                    ], true)) {
                    abort(response()->json([
                        'message' => 'Proof of payment can be submitted only when the review team has configured a fee that is due.',
                    ], 409));
                }

                $storedPath = Storage::disk()->putFile('franchise-application-payment-proofs/'.$application->id, $file);
                if (! $storedPath) {
                    throw new RuntimeException('The proof of payment could not be saved. Please try again.');
                }

                $documents = $application->documents ?? [];
                foreach ($documents as $index => $document) {
                    if (($document['document_type'] ?? null) === 'payment_proof') {
                        $replacedPath = $document['path'] ?? $replacedPath;
                        $replacedDisk = $document['disk'] ?? 'local';
                        unset($documents[$index]);
                    }
                }
                $documents[] = [
                    'path' => $storedPath,
                    'disk' => config('filesystems.default'),
                    'name' => basename($file->getClientOriginalName()),
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                    'uploaded_at' => now()->toIso8601String(),
                    'document_type' => 'payment_proof',
                ];
                $application->documents = array_values($documents);
                $application->franchise_fee_payment_reference = trim((string) $request->input('payment_reference'))
                    ?: $application->franchise_fee_payment_reference;
                $application->franchise_fee_payment_status = 'submitted';
                $application->franchise_fee_payment_reject_reason = null;
                $application->save();

                $this->recordEvent(
                    $application,
                    'applicant',
                    $applicantId,
                    $application->status,
                    'Payment proof submitted',
                    'Your proof of payment was submitted to the franchise team for review.',
                );

                return $application->fresh(['events' => fn ($query) => $query->where('is_internal', false)]);
            });
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk()->delete($storedPath);
            }
            throw $exception;
        }

        if ($replacedPath) {
            Storage::disk($replacedDisk)->delete($replacedPath);
        }

        return response()->json([
            'message' => 'Your payment reference and proof were submitted for review.',
            'data' => $this->applicantApplication($application),
        ]);
    }

    public function withdraw(Request $request, string $id)
    {
        $applicantId = $request->user()->id;
        DB::transaction(function () use ($applicantId, $id) {
            $application = FranchiseApplication::where('franchise_applicant_id', $applicantId)
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
                $applicantId,
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
        $isApplicant = (string) $request->user()?->id === (string) $application->franchise_applicant_id;
        if (! $isApplicant && ! $this->checkAdminAuth($request)) {
            abort(404);
        }

        $file = $application->documents[$document] ?? null;
        $disk = is_array($file) ? Storage::disk($file['disk'] ?? 'local') : null;
        if (! is_array($file) || empty($file['path']) || ! $disk?->exists($file['path'])) {
            abort(404);
        }

        $stream = $disk->readStream($file['path']);
        if (! is_resource($stream)) {
            abort(404);
        }

        return response()->streamDownload(
            function () use ($stream): void {
                try {
                    fpassthru($stream);
                } finally {
                    fclose($stream);
                }
            },
            $file['name'] ?? 'supporting-document',
            ['Content-Type' => $file['mime_type'] ?? 'application/octet-stream'],
        );
    }

    private function applicantApplication(FranchiseApplication $application): array
    {
        $hasConfirmedPacket = $this->hasConfirmedDocumentPacketRequest($application);
        $application->makeHidden([
            'user_id',
            'franchise_applicant_id',
            'admin_notes',
            'reviewed_by_admin_id',
            'reviewed_at',
            'interview_notes',
            'location_assessment',
        ]);
        $application->documents = collect($application->documents ?? [])
            ->map(fn (array $document) => collect($document)->only(['name', 'mime_type', 'size', 'uploaded_at', 'required_document_label', 'document_type'])->all())
            ->all();
        $application->required_documents = collect($hasConfirmedPacket ? ($application->required_documents ?? []) : [])
            ->map(fn (array $document) => collect($document)->except(['template_path'])->all())
            ->all();

        return $application->toArray();
    }

    private function hasConfirmedDocumentPacketRequest(FranchiseApplication $application): bool
    {
        return (bool) $application->required_documents_confirmed_at;
    }
}
