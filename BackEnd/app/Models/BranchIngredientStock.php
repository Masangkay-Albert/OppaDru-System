<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchIngredientStock extends Model
{
    protected $fillable = [
        'branch_id',
        'ingredient_id',
        'quantity',
        'reorder_level',
        'unit_cost',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'reorder_level' => 'decimal:3',
        'unit_cost' => 'decimal:2',
    ];

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(MainBranchIngredient::class, 'ingredient_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Franchise::class, 'branch_id');
    }
}
