<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Franchise extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_account_id',
        'name',
        'slug',
        'email',
        'phone',
        'address',
        'status',
        'owner_admin_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'OPPA-FR-' . strtoupper(Str::random(8));
            }

            if (empty($model->slug)) {
                $model->slug = Str::slug($model->name ?: 'franchise');
            }
        });
    }

    public function users()
    {
        return $this->hasMany(FranchiseUser::class, 'franchise_id', 'id');
    }

    public function franchiseAccount()
    {
        return $this->belongsTo(FranchiseAccount::class, 'franchise_account_id', 'id');
    }

    public function isOperationallyActive(): bool
    {
        return $this->status === 'active'
            && (!$this->franchise_account_id || $this->franchiseAccount?->status === 'active');
    }
}
