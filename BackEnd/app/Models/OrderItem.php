<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'product_name', 'product_price', 'quantity', 'special_instructions'];

    protected $casts = ['product_price' => 'decimal:2'];

    public function addons()
    {
        return $this->hasMany(OrderItemAddon::class);
    }
}