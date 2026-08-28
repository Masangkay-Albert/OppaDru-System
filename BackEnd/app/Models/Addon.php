<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Addon extends Model
{
    protected $fillable = ['addon_group_id', 'name', 'price', 'is_active', 'sort_order'];

    protected $casts = ['price' => 'decimal:2', 'is_active' => 'boolean'];

    public function group()
    {
        return $this->belongsTo(AddonGroup::class, 'addon_group_id');
    }
}