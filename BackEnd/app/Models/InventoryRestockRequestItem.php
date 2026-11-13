<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryRestockRequestItem extends Model
{
    protected $fillable = [
        'request_id',
        'ingredient_id',
        'requested_quantity',
        'approved_quantity',
    ];

    protected $casts = [
        'requested_quantity' => 'decimal:3',
        'approved_quantity' => 'decimal:3',
    ];

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(MainBranchIngredient::class, 'ingredient_id');
    }
}
