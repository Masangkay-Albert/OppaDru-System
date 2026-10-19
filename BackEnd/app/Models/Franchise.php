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
        'latitude',
        'longitude',
        'is_active',
        'accepts_online_orders',
        'delivery_enabled',
        'delivery_radius_km',
        'is_main',
    ];

    protected $casts = [
        'metadata' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
        'is_active' => 'boolean',
        'accepts_online_orders' => 'boolean',
        'delivery_enabled' => 'boolean',
        'delivery_radius_km' => 'decimal:2',
        'is_main' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function (self $franchise): void {
            $hasValidCoordinates = is_numeric($franchise->latitude)
                && is_numeric($franchise->longitude)
                && (float) $franchise->latitude >= 4
                && (float) $franchise->latitude <= 22
                && (float) $franchise->longitude >= 116
                && (float) $franchise->longitude <= 127;
            $canReceiveOnlineDeliveries = ($franchise->status ?? 'active') === 'active'
                && $franchise->is_active !== false
                && $hasValidCoordinates;

            $franchise->accepts_online_orders = $canReceiveOnlineDeliveries;
            $franchise->delivery_enabled = $canReceiveOnlineDeliveries;
        });

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
            && $this->is_active !== false
            && (!$this->franchise_account_id || $this->franchiseAccount?->status === 'active');
    }

    public function acceptsOnlineDelivery(): bool
    {
        return $this->isOperationallyActive() && $this->accepts_online_orders && $this->delivery_enabled;
    }
}
