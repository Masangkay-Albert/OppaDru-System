<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventorySupplier extends Model
{
    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'lead_time_days',
        'notes',
    ];

    protected $casts = [
        'lead_time_days' => 'integer',
    ];

    public function ingredients(): HasMany
    {
        return $this->hasMany(MainBranchIngredient::class, 'supplier_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MainBranchStockMovement::class, 'supplier_id');
    }
}
