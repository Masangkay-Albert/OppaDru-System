<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_id',
        'created_at',
        'updated_at',
        'email',
        'user_id',
        'driver_id',
        'cashier_employee_id',
        'order_number',
        'total',
        'delivery_fee',
        'delivery_distance_km',
        'delivery_calculation_method',
        'delivery_type',
        'delivery_address',
        'delivery_coordinates',
        'delivery_lat',
        'delivery_lng',
        'delivery_proof_image',
        'delivery_proof_uploaded_at',
        'delivery_confirmed_at',
        'service_fee',
        'priority_fee',
        'vat',
        'service_fee_rule',
        'status',
        'payment_method',
        'phone',
        'items',
        'scheduled_at',
        'scheduled_date',
        'scheduled_time',
        'schedule_display',
        'schedule_window',
        'payment_reference',
        'payment_status',
        'discount_type',
        'discount_rate',
        'discount_amount',
        'discount_status',
        'discount_proof_image',
        'discount_rejection_reason',
        'discount_requested_at',
        'discount_reviewed_at',
    ];

    protected $casts = [
        'total' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'delivery_distance_km' => 'decimal:3',
        'delivery_lat' => 'decimal:7',
        'delivery_lng' => 'decimal:7',
        'delivery_type' => 'string',
        'delivery_coordinates' => 'array',
        'delivery_proof_uploaded_at' => 'datetime',
        'delivery_confirmed_at' => 'datetime',
        'service_fee' => 'decimal:2',
        'priority_fee' => 'decimal:2',
        'vat' => 'decimal:2',
        'items' => 'array',
        'scheduled_at' => 'datetime',
        'discount_rate' => 'decimal:4',
        'discount_amount' => 'decimal:2',
        'discount_requested_at' => 'datetime',
        'discount_reviewed_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'OPPA-ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            }
            if (empty($model->order_number)) {
                $model->order_number = 'OPPA-ORD-' . date('Ymd') . '-' . strtoupper(Str::random(8));
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id', 'id');
    }

    public function cashier()
    {
        return $this->belongsTo(Employee::class, 'cashier_employee_id', 'id');
    }

    public function payment()
    {
        return $this->hasOne(Payment::class, 'order_id', 'id');
    }

    public function discountVerificationRequest()
    {
        return $this->hasOne(DiscountVerificationRequest::class, 'order_id', 'id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'order_id', 'id')->with('addons');
    }
}