<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use Illuminate\Http\Request;
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
            $application = DB::transaction(function () use ($request, $applicant, &$storedPaths) {
                $lockedApplicant = FranchiseApplicant::whereKey($applicant->id)->lockForUpdate()->firstOrFail();
                $email = strtolower(trim((string) ($request->filled('email') ? $request->input('email') : $lockedApplicant->email)));
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
                $application = FranchiseApplication::create([
                    'franchise_applicant_id' => $lockedApplicant->id,
                    'franchise_name' => trim((string) $request->input('franchise_name'))
                        ?: 'Oppa Dru - '.$location,
                    'contact_name' => trim((string) $request->input('contact_name')),
                    'email' => $email,
                    'phone' => trim((string) $request->input('phone')),
                    'location' => $location,
                    'applicant_address' => trim((string) $request->input('applicant_address')),
                    'business_experience' => trim((string) $request->input('business_experience')),
                    'investment_capacity' => $request->input('investment_capacity'),
                    'has_proposed_property' => $request->boolean('has_proposed_property'),
                    'opening_timeline' => $request->input('opening_timeline'),
                    'business_information' => $request->input('business_information'),
                    'notes' => $request->input('notes'),
                    'status' => 'under_review',
                    'next_step_instructions' => FranchiseApplication::defaultInstructionsFor('under_review'),
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
                    $lockedApplicant->id,
                    'under_review',
                    'Application submitted',
                    'Your application was received and is now under review.',
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

    public function respond(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'response' => 'required|string|max:5000',
            'documents' => 'nullable|array|max:8',
            'documents.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
            'required_document_uploads' => 'nullable|array|max:8',
            'required_document_uploads.*' => 'file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Your response could not be submitted.', 'errors' => $validator->errors()], 422);
        }

        $applicantId = $request->user()->id;
        $uploadedCount = count($request->file('documents', [])) + count($request->file('required_document_uploads', []));
        if ($uploadedCount > 8) {
            return response()->json(['message' => 'Submit no more than 8 documents in one response.'], 422);
        }
        $storedPaths = [];
        try {
            $application = DB::transaction(function () use ($request, $id, $applicantId, &$storedPaths) {
                $application = FranchiseApplication::where('franchise_applicant_id', $applicantId)
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->firstOrFail();
                if ($application->status !== 'additional_information_required') {
                    abort(response()->json(['message' => 'A response can only be sent when additional information has been requested.'], 409));
                }

                $documents = $application->documents ?? [];
                $requiredDocuments = $application->required_documents ?? [];
                $requestedForCombinedReview = FranchiseApplicationEvent::query()
                    ->where('application_id', $application->id)
                    ->where('title', 'Status updated')
                    ->where('status', 'location_assessment')
                    ->exists();
                $requiredUploads = $request->file('required_document_uploads', []);
                if ($requestedForCombinedReview) {
                    $missingDocuments = [];
                    foreach ($requiredDocuments as $index => $requiredDocument) {
                        if (($requiredDocument['required'] ?? false) && empty($requiredUploads[$index])) {
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
                        $path = Storage::disk('local')->putFile('franchise-applications/'.$application->id, $file);
                        if (! $path) {
                            throw new RuntimeException('A supporting document could not be saved. Please try again.');
                        }
                        $storedPaths[] = $path;
                        $storedDocument = [
                            'path' => $path,
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
                            $requiredDocuments[$requirementIndex]['status'] = 'received';
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

    public function downloadRequiredDocumentTemplate(Request $request, string $id, int $document)
    {
        $application = FranchiseApplication::query()
            ->where('franchise_applicant_id', $request->user()->id)
            ->findOrFail($id);
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
        if (! is_array($file) || empty($file['path']) || ! Storage::disk('local')->exists($file['path'])) {
            abort(404);
        }

        $stream = Storage::disk('local')->readStream($file['path']);
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
            ->map(fn (array $document) => collect($document)->only(['name', 'mime_type', 'size', 'uploaded_at', 'required_document_label'])->all())
            ->all();
        $application->required_documents = collect($application->required_documents ?? [])
            ->map(fn (array $document) => collect($document)->except(['template_path', 'submitted_document_index'])->all())
            ->all();

        return $application->toArray();
    }
}
