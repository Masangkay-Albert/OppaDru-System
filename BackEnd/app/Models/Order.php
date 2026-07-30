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
        'order_number',
        'total',
        'status',
        'payment_method',
        'delivery_address',
        'phone',
        'items',
    ];

    protected $casts = [
        'total' => 'decimal:2',
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
}