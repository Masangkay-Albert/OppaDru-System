<?php

namespace App\Models;

use App\Notifications\VerifyFranchiseApplicantEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class FranchiseApplicant extends Authenticatable implements MustVerifyEmail
{
    use Notifiable;

    protected $table = 'franchise_applicants';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'full_name',
        'email',
        'phone',
        'password',
        'api_token',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'email_verified_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $applicant): void {
            if (empty($applicant->id)) {
                $applicant->id = 'OPPA-FRA-'.strtoupper(Str::random(12));
            }
        });
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyFranchiseApplicantEmail);
    }

    public function applications()
    {
        return $this->hasMany(FranchiseApplication::class, 'franchise_applicant_id');
    }
}
