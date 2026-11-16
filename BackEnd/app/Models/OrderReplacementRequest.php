<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderReplacementRequest extends Model
{
    protected $fillable = [
        'order_id',
        'user_id',
        'branch_id',
        'franchise_id',
        'franchise_account_id',
        'issue_type',
        'affected_items',
        'description',
        'photo_paths',
        'status',
        'reject_reason',
        'handled_by',
        'handled_at',
        'replacement_order_id',
    ];

    protected $casts = [
        'affected_items' => 'array',
        'photo_paths' => 'array',
        'handled_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id', 'id');
    }

    public function replacementOrder()
    {
        return $this->belongsTo(Order::class, 'replacement_order_id', 'id');
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
