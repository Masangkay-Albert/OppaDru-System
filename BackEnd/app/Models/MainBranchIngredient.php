<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainBranchIngredient extends Model
{
    protected $table = 'main_branch_ingredients';

    protected $fillable = [
        'name',
        'category',
        'unit',
        'purchase_unit',
        'conversion_factor',
        'quantity',
        'reorder_level',
        'unit_cost',
        'inventory_value',
        'supplier',
        'supplier_id',
        'notes',
        'is_archived',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'reorder_level' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'inventory_value' => 'decimal:2',
        'conversion_factor' => 'decimal:6',
        'is_archived' => 'boolean',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(MainBranchStockMovement::class, 'ingredient_id');
    }

    public function supplierRelation(): BelongsTo
    {
        return $this->belongsTo(InventorySupplier::class, 'supplier_id');
    }
}
