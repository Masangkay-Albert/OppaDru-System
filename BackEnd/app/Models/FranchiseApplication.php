<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FranchiseApplication extends Model
{
    use HasFactory;

    public const STATUSES = [
        'submitted',
        'under_review',
        'additional_information_required',
        'for_interview',
        'location_assessment',
        'conditionally_approved',
        'for_final_evaluation',
        'agreement_pending',
        'requirements_pending',
        'approved_for_opening',
        'active',
        'approved',
        'rejected',
        'withdrawn',
        'on_hold',
    ];

    public const STATUS_TRANSITIONS = [
        'pending' => ['under_review', 'on_hold', 'rejected'],
        'submitted' => ['under_review', 'on_hold', 'rejected'],
        'under_review' => ['additional_information_required', 'for_interview', 'location_assessment', 'for_final_evaluation', 'conditionally_approved', 'on_hold', 'rejected'],
        'additional_information_required' => ['under_review', 'on_hold', 'rejected'],
        'for_interview' => ['under_review', 'location_assessment', 'for_final_evaluation', 'conditionally_approved', 'on_hold', 'rejected'],
        'location_assessment' => ['under_review', 'additional_information_required', 'for_final_evaluation', 'conditionally_approved', 'on_hold', 'rejected'],
        'conditionally_approved' => ['agreement_pending', 'requirements_pending', 'approved_for_opening', 'on_hold', 'rejected'],
        'for_final_evaluation' => ['location_assessment', 'agreement_pending', 'requirements_pending', 'approved_for_opening', 'on_hold', 'rejected'],
        'agreement_pending' => ['requirements_pending', 'on_hold', 'rejected'],
        'requirements_pending' => ['agreement_pending', 'approved_for_opening', 'on_hold', 'rejected'],
        'approved_for_opening' => ['requirements_pending', 'on_hold'],
        'on_hold' => ['under_review', 'for_interview', 'location_assessment', 'conditionally_approved', 'agreement_pending', 'requirements_pending', 'approved_for_opening', 'rejected'],
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'reference_number',
        'franchise_name',
        'contact_name',
        'user_id',
        'franchise_applicant_id',
        'email',
        'phone',
        'location',
        'proposed_latitude',
        'proposed_longitude',
        'applicant_address',
        'business_experience',
        'investment_capacity',
        'has_proposed_property',
        'property_status',
        'opening_timeline',
        'business_information',
        'documents',
        'notes',
        'status',
        'admin_notes',
        'next_step_instructions',
        'reviewed_by_admin_id',
        'reviewed_at',
        'interview_at',
        'interview_type',
        'interview_location',
        'interview_notes',
        'interview_meeting_url',
        'location_assessment',
        'agreement_status',
        'agreement_prepared_at',
        'agreement_signed_at',
        'franchise_fee_amount',
        'franchise_fee_payment_status',
        'franchise_fee_payment_reference',
        'franchise_fee_payment_reject_reason',
        'required_documents',
        'requirements_reviewed_at',
        'location_readiness',
        'permit_compliance_status',
        'training_status',
        'operational_preparation_status',
        'franchise_account_id',
        'franchise_id',
        'activated_at',
        'activated_by_admin_id',
        'approved_at',
        'approved_by_admin_id',
        'approval_override_reason',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'investment_capacity' => 'decimal:2',
        'proposed_latitude' => 'float',
        'proposed_longitude' => 'float',
        'has_proposed_property' => 'boolean',
        'documents' => 'array',
        'interview_at' => 'datetime',
        'location_assessment' => 'array',
        'agreement_prepared_at' => 'datetime',
        'agreement_signed_at' => 'datetime',
        'franchise_fee_amount' => 'decimal:2',
        'required_documents' => 'array',
        'requirements_reviewed_at' => 'datetime',
        'activated_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'OPPA-FAPP-'.strtoupper(Str::random(8));
            }

            if (empty($model->reference_number)) {
                $reference = 'OPPA-'.date('Y').'-'.strtoupper(Str::random(8));

                while (static::where('reference_number', $reference)->exists()) {
                    $reference = 'OPPA-'.date('Y').'-'.strtoupper(Str::random(8));
                }

                $model->reference_number = $reference;
            }
        });
    }

    public function applicant()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function franchiseApplicant()
    {
        return $this->belongsTo(FranchiseApplicant::class, 'franchise_applicant_id');
    }

    public function events()
    {
        return $this->hasMany(FranchiseApplicationEvent::class, 'application_id')->orderBy('created_at');
    }

    public function franchiseAccount()
    {
        return $this->belongsTo(FranchiseAccount::class, 'franchise_account_id', 'id');
    }

    public function franchise()
    {
        return $this->belongsTo(Franchise::class, 'franchise_id', 'id');
    }

    public function allowedTransitions(): array
    {
        $currentStatus = $this->status === 'pending' ? 'submitted' : ($this->status ?: 'submitted');
        $transitions = self::STATUS_TRANSITIONS[$currentStatus] ?? [];
        $transitions = array_values(array_diff($transitions, ['additional_information_required']));

        if (! in_array($currentStatus, ['active', 'approved', 'rejected', 'withdrawn'], true)) {
            array_unshift($transitions, $currentStatus);
        }

        return array_values(array_unique($transitions));
    }

    public function canTransitionTo(string $targetStatus): bool
    {
        return in_array($targetStatus, $this->allowedTransitions(), true);
    }

    public static function defaultInstructionsFor(string $status): string
    {
        return [
            'submitted' => 'Your application has been submitted and is waiting for review.',
            'under_review' => 'The franchise team is reviewing your experience, financial readiness, and proposed location.',
            'additional_information_required' => 'Please submit the additional information requested below.',
            'for_interview' => 'Please attend the interview at the scheduled Philippine time and follow the instructions below.',
            'location_assessment' => 'The franchise team is completing the site assessment, financial review, and final franchise evaluation. If documents are requested, submit all of them together in one response.',
            'conditionally_approved' => 'Your application has passed the location assessment. The franchisor is completing the financial and final evaluation before preparing the franchise agreement.',
            'agreement_pending' => 'Review and sign the franchise agreement. The next setup stage cannot begin until the agreement is recorded as signed.',
            'requirements_pending' => 'Complete the agreed payment, location, permits, construction/equipment, staffing, training, and system setup requirements that apply to your franchise.',
            'approved_for_opening' => 'Opening readiness is approved. Await final authorized activation before beginning operations.',
            'active' => 'Your franchise is active. Follow the operations, reporting, and compliance instructions in the franchise portal.',
                'for_final_evaluation' => 'Your application is in its final evaluation. The franchise team will contact you with its decision.',
                'approved' => 'Your franchise is approved. Sign in to the Franchisee Portal to access your dashboard.',
            'rejected' => 'The franchise team has completed its review and this application was not approved.',
            'withdrawn' => 'This application has been withdrawn.',
            'on_hold' => 'Your application is temporarily on hold. Follow the instructions below or contact the franchise team.',
        ][$status] ?? 'Follow the latest instructions from the franchise team.';
    }

    public function activationReadinessIssues(): array
    {
        $issues = [];
        if ($this->agreement_status !== 'signed' || ! $this->agreement_signed_at) {
            $issues[] = 'The franchise agreement must be recorded as signed with its actual signing date.';
        }
        if (! in_array($this->franchise_fee_payment_status, ['paid', 'waived', 'not_applicable'], true)) {
            $issues[] = 'The applicable franchise fee must be paid, waived with a recorded reason, or explicitly marked not applicable.';
        }
        if ($this->franchise_fee_payment_status === 'paid'
            && (! $this->franchise_fee_amount
                || ! collect($this->documents ?? [])->contains('document_type', 'payment_proof'))) {
            $issues[] = 'The paid franchise fee must include its amount and an applicant-submitted proof of payment.';
        }
        if (! $this->requirements_reviewed_at) {
            $issues[] = 'An administrator must review and save the requirements checklist.';
        }
        foreach ($this->required_documents ?? [] as $document) {
            if (($document['required'] ?? false) && ! in_array($document['status'] ?? null, ['verified', 'not_applicable'], true)) {
                $issues[] = 'Required document not verified: '.($document['label'] ?? 'Unnamed document').'.';
            }
        }
        if (! in_array($this->location_readiness, ['ready', 'not_applicable'], true)) {
            $issues[] = 'Location readiness must be confirmed or explicitly marked not applicable.';
        }
        if (! in_array($this->permit_compliance_status, ['verified', 'not_applicable'], true)) {
            $issues[] = 'Permit and compliance checks must be verified or explicitly marked not applicable.';
        }
        if (! in_array($this->training_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Required training must be complete or explicitly marked not applicable.';
        }
        if (! in_array($this->operational_preparation_status, ['complete', 'not_applicable'], true)) {
            $issues[] = 'Operational preparation must be complete or explicitly marked not applicable.';
        }

        return $issues;
    }

    public function finalApprovalDocumentIssues(): array
    {
        $issues = [];
        if (! $this->requirements_reviewed_at) {
            $issues[] = 'An administrator must review and save the requested documents before final approval.';
        }
        foreach ($this->required_documents ?? [] as $document) {
            if (($document['required'] ?? false) && ! in_array($document['status'] ?? null, ['verified', 'not_applicable'], true)) {
                $issues[] = 'Required document not verified: '.($document['label'] ?? 'Unnamed document').'.';
            }
        }

        return $issues;
    }
}
