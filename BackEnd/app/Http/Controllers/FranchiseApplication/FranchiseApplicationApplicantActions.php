<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\FranchiseApplication;
use App\Models\User;
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
                $lockedUser = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
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
