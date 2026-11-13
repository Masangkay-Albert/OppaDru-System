<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransferItem extends Model
{
    protected $fillable = [
        'transfer_id',
        'ingredient_id',
        'quantity',
        'source_movement_id',
        'batch_lots',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'batch_lots' => 'array',
    ];

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(MainBranchIngredient::class, 'ingredient_id');
    }
}
