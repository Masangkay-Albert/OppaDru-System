<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DiscountVerificationRequest extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_id',
        'discount_type',
        'discount_rate',
        'discount_amount',
        'proof_image_url',
        'status',
        'rejection_reason',
        'submitted_at',
        'reviewed_at',
        'reviewed_by_admin_id',
        'order_total_at_submission',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
        'discount_rate' => 'decimal:4',
        'order_total_at_submission' => 'decimal:2',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'DISCOUNT-' . strtoupper(Str::random(10));
            }
        });
    }

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id', 'id');
    }
}
