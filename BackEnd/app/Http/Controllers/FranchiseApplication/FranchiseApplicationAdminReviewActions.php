<?php

namespace App\Http\Controllers\FranchiseApplication;

use App\Models\Admin;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

trait FranchiseApplicationAdminReviewActions
{
    public function index(Request $request)
    {
        if (! $this->checkAdminAuth($request)) {
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
        if (! $this->checkAdminAuth($request)) {
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

            $previousStatus = $currentStatus;
            $previousInstructions = $application->next_step_instructions;
            $previousInterviewNotes = $application->interview_notes;
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
            if ($request->has('interview_at')) {
                $application->interview_at = $requestedInterviewAt;
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
            if (in_array($application->status, ['active', 'rejected', 'withdrawn'], true)) {
                abort(response()->json([
                    'message' => 'Requirements cannot be changed for active, rejected, or withdrawn applications.',
                ], 409));
            }

            $today = CarbonImmutable::now('Asia/Manila')->toDateString();
            foreach (['agreement_prepared_at', 'agreement_signed_at'] as $dateField) {
                if (! $request->filled($dateField)) {
                    continue;
                }

                $requestedDate = CarbonImmutable::parse((string) $request->input($dateField))->toDateString();
                $savedDate = $application->{$dateField}?->toDateString();
                if ($requestedDate < $today && $requestedDate !== $savedDate) {
                    abort(response()->json([
                        'message' => 'Agreement dates cannot be in the past.',
                        'errors' => [$dateField => ['Choose today or a future date.']],
                    ], 422));
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
}
