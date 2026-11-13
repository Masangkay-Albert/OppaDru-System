<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryRestockRequest extends Model
{
    protected $fillable = [
        'branch_id',
        'status',
        'requested_by',
        'reviewed_by',
        'notes',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(InventoryRestockRequestItem::class, 'request_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Franchise::class, 'branch_id');
    }
}
