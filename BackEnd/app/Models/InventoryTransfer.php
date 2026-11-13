<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransfer extends Model
{
    protected $fillable = [
        'source_branch_id',
        'destination_branch_id',
        'request_id',
        'reference',
        'status',
        'notes',
        'dispatched_by',
        'received_at',
    ];

    protected $casts = [
        'received_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(InventoryTransferItem::class, 'transfer_id');
    }

    public function destinationBranch(): BelongsTo
    {
        return $this->belongsTo(Franchise::class, 'destination_branch_id');
    }
}
