<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DiscountApplication extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_id',
        'user_id',
        'discount_type',
        'full_name',
        'id_number',
        'expiry_date',
        'proof_image_url',
        'proof_image_data',
        'status',
        'rejection_reason',
        'submitted_at',
        'reviewed_at',
        'reviewed_by_admin_id',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'expiry_date' => 'date',
    ];

    protected $hidden = [
        'proof_image_data',
    ];

    public function getProofImageUrlAttribute(?string $value): ?string
    {
        if (! $value && empty($this->attributes['proof_image_data'])) {
            return null;
        }

        $imageData = $this->attributes['proof_image_data'] ?? null;
        $version = is_string($imageData) && $imageData !== ''
            ? sha1($imageData)
            : ($this->submitted_at?->format('U.u') ?? 'current');

        return url('/api/discount-applications/'.$this->id.'/proof-image').'?v='.rawurlencode($version);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'DISCAPP-' . strtoupper(Str::random(10));
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
