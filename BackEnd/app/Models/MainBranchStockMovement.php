<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MainBranchStockMovement extends Model
{
    protected $table = 'stock_movements';

    protected $fillable = [
        'ingredient_id',
        'branch_id',
        'ingredient_name',
        'unit',
        'type',
        'quantity',
        'quantity_change',
        'quantity_before',
        'quantity_after',
        'unit_cost',
        'reason',
        'order_id',
        'supplier_id',
        'purchase_quantity',
        'purchase_unit',
        'invoice_reference',
        'occurred_at',
        'admin_id',
        'user_id',
        'actor_type',
        'actor_id',
        'performed_by',
    ];

    protected $casts = [
        'quantity_change' => 'decimal:3',
        'quantity_before' => 'decimal:3',
        'quantity_after' => 'decimal:3',
        'unit_cost' => 'decimal:4',
        'purchase_quantity' => 'decimal:3',
        'occurred_at' => 'datetime',
    ];

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(MainBranchIngredient::class, 'ingredient_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(InventorySupplier::class, 'supplier_id');
    }
}
