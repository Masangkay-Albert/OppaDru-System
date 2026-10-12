<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\Admin;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use RuntimeException;
use Throwable;

trait FranchiseApplicationAdminReviewActions
{
    public function index(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $applications = FranchiseApplication::with(['applicant:id,full_name,email'])
            ->orderBy('created_at', 'desc')
            ->get();
        $applications->each(fn (FranchiseApplication $application) => $application->setAttribute(
            'allowed_transitions',
            $application->allowedTransitions(),
        ));

        return response()->json(['data' => $applications]);
    }

    public function showAdmin(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $application = FranchiseApplication::with(['applicant:id,full_name,email', 'events'])
            ->findOrFail($id);
        $application->setAttribute('allowed_transitions', $application->allowedTransitions());

        return response()->json(['data' => $application]);
    }

    public function review(Request $request, string $id)
    {
        if (! $this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:'.implode(',', array_diff(FranchiseApplication::STATUSES, ['active', 'withdrawn'])),
            'admin_notes' => 'nullable|string|max:5000',
            'next_step_instructions' => 'nullable|string|max:2000',
            'interview_at' => 'nullable|date',
            'interview_type' => 'nullable|string|in:online,onsite',
            'interview_location' => 'nullable|string|max:500|required_if:interview_type,onsite',
            'interview_notes' => 'nullable|string|max:5000',
            'interview_meeting_url' => 'nullable|url:http,https|max:2048',
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
            if (! $application->canTransitionTo($targetStatus)) {
                abort(response()->json([
                    'message' => "The application cannot move from {$currentStatus} to {$targetStatus}.",
                ], 409));
            }
            if ($targetStatus === 'additional_information_required' && ! $request->filled('next_step_instructions')) {
                abort(response()->json(['message' => 'Provide clear instructions for the additional information required.'], 422));
            }
            if ($currentStatus === 'location_assessment'
                && $targetStatus === 'additional_information_required'
                && FranchiseApplicationEvent::query()
                    ->where('application_id', $application->id)
                    ->where('title', 'Additional information submitted')
                    ->where('status', 'location_assessment')
                    ->exists()) {
                abort(response()->json([
                    'message' => 'The combined post-interview document packet has already been submitted. Review the submitted documents and continue the final assessment.',
                ], 409));
            }
            if ($currentStatus === 'location_assessment' && $targetStatus === 'additional_information_required') {
                $missingTemplates = collect($application->required_documents ?? [])
                    ->filter(fn (array $document) => ($document['required'] ?? false) && empty($document['template_path']))
                    ->pluck('label')
                    ->values()
                    ->all();
                if ($missingTemplates !== []) {
                    abort(response()->json([
                        'message' => 'Upload a blank template for each required document before requesting the combined document packet.',
                        'missing_templates' => $missingTemplates,
                    ], 409));
                }
            }
            if ($targetStatus === 'for_interview' && ! $request->filled('interview_at')) {
                abort(response()->json(['message' => 'Set an interview date and time before moving this application to For Interview.'], 422));
            }
            if ($currentStatus !== $targetStatus
                && $targetStatus === 'requirements_pending'
                && ($application->agreement_status !== 'signed' || ! $application->agreement_signed_at)) {
                abort(response()->json([
                    'message' => 'Record the signed franchise agreement before moving to payment and business setup.',
                    'requirements' => ['A signed franchise agreement and its actual signing date are required.'],
                ], 409));
            }
            if ($currentStatus !== $targetStatus && $targetStatus === 'approved_for_opening') {
                $issues = $application->activationReadinessIssues();
                if ($issues !== []) {
                    abort(response()->json([
                        'message' => 'Complete opening readiness checks before approving the franchise for opening.',
                        'requirements' => $issues,
                    ], 409));
                }
            }

            $previousStatus = $currentStatus;
            $previousInstructions = $application->next_step_instructions;
            $previousInterviewNotes = $application->interview_notes;
            $previousInterviewMeetingUrl = $application->interview_meeting_url;
            $previousAssessmentNotes = data_get($application->location_assessment, 'notes');
            $requestedInterviewAt = $request->filled('interview_at')
                ? CarbonImmutable::parse((string) $request->input('interview_at'))
                : null;
            $interviewDateChanged = $requestedInterviewAt
                && (! $application->interview_at || ! $requestedInterviewAt->equalTo($application->interview_at));
            if (
                $requestedInterviewAt?->isPast()
                && ($targetStatus === 'for_interview' || $interviewDateChanged)
            ) {
                abort(response()->json([
                    'message' => 'Interview date and time must be current or in the future.',
                    'errors' => ['interview_at' => ['Choose a current or future interview date and time.']],
                ], 422));
            }

            $application->status = $targetStatus;
            $application->reviewed_by_admin_id = $admin?->id;
            $application->reviewed_at = now();
            if ($request->has('next_step_instructions')) {
                $application->next_step_instructions = $request->input('next_step_instructions');
            }
            if ($previousStatus !== $targetStatus
                && (! $request->filled('next_step_instructions')
                    || $request->input('next_step_instructions') === $previousInstructions)) {
                $application->next_step_instructions = FranchiseApplication::defaultInstructionsFor($targetStatus);
            }
            if ($request->has('interview_at')) {
                $application->interview_at = $requestedInterviewAt;
            }
            if ($request->has('interview_type')) {
                $application->interview_type = $request->input('interview_type');
                if ($request->input('interview_type') === 'onsite') {
                    $application->interview_meeting_url = null;
                } elseif ($request->input('interview_type') === 'online') {
                    $application->interview_location = null;
                }
            }
            if ($request->has('interview_location')) {
                $application->interview_location = $request->input('interview_location');
            }
            if ($request->has('interview_notes')) {
                $application->interview_notes = $request->input('interview_notes');
            }
            if ($request->has('interview_meeting_url')) {
                $application->interview_meeting_url = $request->input('interview_meeting_url');
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

            if ($previousStatus !== $targetStatus || $previousInstructions !== $application->next_step_instructions) {
                $this->recordEvent(
                    $application,
                    'admin',
                    $admin?->id,
                    $targetStatus,
                    $previousStatus !== $targetStatus ? 'Status updated' : 'Instructions updated',
                    $application->next_step_instructions ?: 'Your application status was updated.',
                );
            }

            if ($request->filled('admin_notes')) {
                $this->recordEvent($application, 'admin', $admin?->id, $targetStatus, 'Internal review note added', $request->input('admin_notes'), true);
            }
            if ($requestedInterviewAt) {
                $interviewMessage = 'Interview scheduled for '.$requestedInterviewAt->setTimezone('Asia/Manila')->format('F j, Y g:i A').' (Philippine time).';
                $interviewEventExists = FranchiseApplicationEvent::where('application_id', $application->id)
                    ->where('title', 'Interview scheduled')
                    ->where('message', $interviewMessage)
                    ->exists();
            } else {
                $interviewMessage = '';
                $interviewEventExists = false;
            }
            if ($requestedInterviewAt && ! $interviewEventExists) {
                $this->recordEvent(
                    $application,
                    'admin',
                    $admin?->id,
                    $targetStatus,
                    'Interview scheduled',
                    $interviewMessage,
                );
            }
            if ($request->filled('interview_notes') && $previousInterviewNotes !== $request->input('interview_notes')) {
                $this->recordEvent($application, 'admin', $admin?->id, $targetStatus, 'Interview notes added', $request->input('interview_notes'), true);
            }
            if ($previousInterviewMeetingUrl !== $application->interview_meeting_url) {
                $this->recordEvent(
                    $application,
                    'admin',
                    $admin?->id,
                    $targetStatus,
                    $application->interview_meeting_url ? 'Online interview link added' : 'Online interview link removed',
                    $application->interview_meeting_url
                        ? 'An online interview link is available in your application details.'
                        : 'The online interview link was removed.',
                );
            }
            if ($request->filled('location_assessment.notes') && $previousAssessmentNotes !== $request->input('location_assessment.notes')) {
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

        if (is_string($request->input('required_documents'))) {
            $documents = json_decode($request->input('required_documents'), true);
            if (! is_array($documents)) {
                return response()->json(['message' => 'The required document list is invalid.'], 422);
            }
            $request->merge(['required_documents' => $documents]);
        }

        $validator = Validator::make($request->all(), [
            'agreement_status' => 'required|string|in:not_started,drafting,sent,signed',
            'agreement_prepared_at' => 'nullable|date',
            'agreement_signed_at' => 'nullable|date',
            'franchise_fee_amount' => 'nullable|numeric|min:0|max:9999999999.99',
            'franchise_fee_payment_status' => 'required|string|in:not_configured,pending,paid,waived,not_applicable',
            'franchise_fee_payment_reference' => 'nullable|string|max:255',
            'required_documents' => 'present|array|max:8',
            'required_documents.*.label' => 'required|string|max:255|distinct',
            'required_documents.*.required' => 'required|boolean',
            'required_documents.*.status' => 'required|string|in:pending,received,verified,not_applicable',
            'required_documents.*.template_name' => 'nullable|string|max:255',
            'required_document_templates' => 'nullable|array|max:8',
            'required_document_templates.*' => 'file|mimes:pdf,doc,docx|max:10240',
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
        $newTemplatePaths = [];
        $oldTemplatePaths = [];
        try {
            $application = DB::transaction(function () use ($id, $request, $admin, &$newTemplatePaths, &$oldTemplatePaths) {
                $application = FranchiseApplication::whereKey($id)->lockForUpdate()->firstOrFail();
                if (in_array($application->status, ['active', 'rejected', 'withdrawn'], true)) {
                    abort(response()->json([
                        'message' => 'Requirements cannot be changed for active, rejected, or withdrawn applications.',
                    ], 409));
                }

                $previousDocuments = $application->required_documents ?? [];
                $documents = $request->input('required_documents');
                foreach ($documents as $index => &$document) {
                    $previous = collect($previousDocuments)->firstWhere('label', $document['label']);
                    $template = $request->file("required_document_templates.$index");
                    if ($template) {
                        $path = Storage::disk('local')->putFile('franchise-application-templates/'.$application->id, $template);
                        if (! $path) {
                            throw new RuntimeException('A required document template could not be saved. Please try again.');
                        }
                        $newTemplatePaths[] = $path;
                        if (! empty($previous['template_path'])) {
                            $oldTemplatePaths[] = $previous['template_path'];
                        }
                        $document['template_path'] = $path;
                        $document['template_name'] = basename($template->getClientOriginalName());
                    } elseif (! empty($document['template_name']) && ! empty($previous['template_path'])) {
                        $document['template_path'] = $previous['template_path'];
                        $document['template_name'] = $previous['template_name'];
                    } else {
                        if (! empty($previous['template_path'])) {
                            $oldTemplatePaths[] = $previous['template_path'];
                        }
                        unset($document['template_path'], $document['template_name']);
                    }

                    if (isset($previous['submitted_document_name'])) {
                        $document['submitted_document_name'] = $previous['submitted_document_name'];
                        $document['submitted_document_index'] = $previous['submitted_document_index'] ?? null;
                    }
                }
                unset($document);
                foreach ($previousDocuments as $previousDocument) {
                    if (! collect($documents)->contains('label', $previousDocument['label'] ?? null)
                        && ! empty($previousDocument['template_path'])) {
                        $oldTemplatePaths[] = $previousDocument['template_path'];
                    }
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
                $application->required_documents = $documents;
                $application->requirements_reviewed_at = now();
                $application->reviewed_by_admin_id = $admin?->id;
                $application->reviewed_at = now();
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
        } catch (Throwable $exception) {
            if ($newTemplatePaths !== []) {
                Storage::disk('local')->delete($newTemplatePaths);
            }
            throw $exception;
        }
        if ($oldTemplatePaths !== []) {
            Storage::disk('local')->delete(array_unique($oldTemplatePaths));
        }

        return response()->json([
            'message' => 'Agreement and opening requirements saved.',
            'data' => $application,
        ]);
    }

    public function stats(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
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
}
