<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AddonGroup extends Model
{
    protected $fillable = [
        'name', 'selection_type', 'supports_quantity', 'max_selections',
        'applicable_categories', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'applicable_categories' => 'array',
        'supports_quantity' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function addons()
    {
        return $this->hasMany(Addon::class)->orderBy('sort_order')->orderBy('name');
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'product_addon_groups', 'addon_group_id', 'product_id');
    }
}