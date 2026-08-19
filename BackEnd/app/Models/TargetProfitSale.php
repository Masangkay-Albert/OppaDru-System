<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TargetProfitSale extends Model
{
    protected $table = 'target_profit_sales';

    protected $fillable = [
        'singleton_key',
        'target_amount',
    ];

    protected $casts = [
        'target_amount' => 'decimal:2',
    ];
}