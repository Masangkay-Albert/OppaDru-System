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
        'location_status',
        'location_error',
        'sales_target_amount',
    ];

    protected $casts = [
        'metadata' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
        'is_active' => 'boolean',
        'accepts_online_orders' => 'boolean',
        'delivery_enabled' => 'boolean',
        'delivery_radius_km' => 'float',
        'is_main' => 'boolean',
        'location_status' => 'string',
        'sales_target_amount' => 'float',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $hasValidCoordinates = is_numeric($model->latitude)
                && is_numeric($model->longitude)
                && (float) $model->latitude >= 4
                && (float) $model->latitude <= 22
                && (float) $model->longitude >= 116
                && (float) $model->longitude <= 127;
            $canReceiveOnlineDeliveries = ($model->status ?? 'active') === 'active'
                && $model->is_active !== false
                && $hasValidCoordinates;

            if (! $canReceiveOnlineDeliveries) {
                $model->accepts_online_orders = false;
                $model->delivery_enabled = false;
            } else {
                if (! array_key_exists('accepts_online_orders', $model->getAttributes())) {
                    $model->accepts_online_orders = true;
                }
                if (! array_key_exists('delivery_enabled', $model->getAttributes())) {
                    $model->delivery_enabled = true;
                }
            }

            if (empty($model->id)) {
                $model->id = 'OPPA-FR-' . strtoupper(Str::random(8));
            }

            if (empty($model->slug)) {
                $model->slug = Str::slug($model->name ?: 'franchise');
            }
        });

        static::saving(function (self $franchise): void {
            $hasValidCoordinates = is_numeric($franchise->latitude)
                && is_numeric($franchise->longitude)
                && (float) $franchise->latitude >= 4
                && (float) $franchise->latitude <= 22
                && (float) $franchise->longitude >= 116
                && (float) $franchise->longitude <= 127;

            if (($franchise->status ?? 'active') !== 'active'
                || $franchise->is_active === false
                || ! $hasValidCoordinates) {
                $franchise->accepts_online_orders = false;
                $franchise->delivery_enabled = false;
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
