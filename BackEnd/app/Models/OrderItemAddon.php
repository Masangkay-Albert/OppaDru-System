<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItemAddon extends Model
{
    protected $fillable = ['order_item_id', 'addon_id', 'addon_name', 'unit_price', 'quantity'];

    protected $casts = ['unit_price' => 'decimal:2'];
}