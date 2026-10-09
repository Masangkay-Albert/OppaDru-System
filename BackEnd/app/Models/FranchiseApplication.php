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
        'agreement_pending',
        'requirements_pending',
        'approved_for_opening',
        'active',
        'rejected',
        'withdrawn',
        'on_hold',
    ];

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'reference_number',
        'franchise_name',
        'contact_name',
        'user_id',
        'email',
        'phone',
        'location',
        'applicant_address',
        'business_experience',
        'investment_capacity',
        'has_proposed_property',
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
        'interview_notes',
        'location_assessment',
        'agreement_status',
        'agreement_prepared_at',
        'agreement_signed_at',
        'franchise_fee_amount',
        'franchise_fee_payment_status',
        'franchise_fee_payment_reference',
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
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'investment_capacity' => 'decimal:2',
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
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'OPPA-FAPP-' . strtoupper(Str::random(8));
            }

            if (empty($model->reference_number)) {
                $reference = 'OPPA-' . date('Y') . '-' . strtoupper(Str::random(8));

                while (static::where('reference_number', $reference)->exists()) {
                    $reference = 'OPPA-' . date('Y') . '-' . strtoupper(Str::random(8));
                }

                $model->reference_number = $reference;
            }
        });
    }

    public function applicant()
    {
        return $this->belongsTo(User::class, 'user_id');
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
}
