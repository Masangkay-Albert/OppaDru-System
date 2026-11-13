<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBatch extends Model
{
    protected $fillable = [
        'branch_id',
        'ingredient_id',
        'movement_id',
        'quantity_received',
        'quantity_remaining',
        'received_at',
        'expires_at',
    ];

    protected $casts = [
        'quantity_received' => 'decimal:3',
        'quantity_remaining' => 'decimal:3',
        'received_at' => 'datetime',
        'expires_at' => 'date',
    ];

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(MainBranchIngredient::class, 'ingredient_id');
    }
}
