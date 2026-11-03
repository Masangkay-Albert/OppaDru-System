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
        'branch_name',
        'branch_description',
        'branch_price',
        'branch_category',
        'branch_image',
        'is_archived',
        'is_hidden',
    ];

    protected $casts = [
        'stock_quantity' => 'integer',
        'is_available' => 'boolean',
        'branch_price' => 'decimal:2',
        'is_archived' => 'boolean',
        'is_hidden' => 'boolean',
    ];
}
