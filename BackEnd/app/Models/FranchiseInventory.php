<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FranchiseInventory extends Model
{
    protected $table = 'franchise_inventory';

    protected $fillable = [
        'franchise_id',
        'product_id',
        'stock_quantity',
        'is_available',
    ];

    protected $casts = [
        'stock_quantity' => 'integer',
        'is_available' => 'boolean',
    ];
}
