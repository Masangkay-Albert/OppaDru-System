<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FranchiseApplicationEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'application_id',
        'actor_type',
        'actor_id',
        'status',
        'title',
        'message',
        'is_internal',
        'created_at',
    ];

    protected $casts = [
        'is_internal' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(FranchiseApplication::class, 'application_id');
    }
}
