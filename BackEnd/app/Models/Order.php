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
        'email',
        'user_id',
        'order_number',
        'total',
        'delivery_fee',
        'delivery_distance_km',
        'delivery_calculation_method',
        'service_fee',
        'service_fee_rule',
        'status',
        'payment_method',
        'delivery_address',
        'phone',
        'items',
        'payment_reference',
        'payment_status',
    ];

    protected $casts = [
        'total' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'delivery_distance_km' => 'decimal:3',
        'service_fee' => 'decimal:2',
        'items' => 'array',
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

    public function payment()
    {
        return $this->hasOne(Payment::class, 'order_id', 'id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'order_id', 'id')->with('addons');
    }
}