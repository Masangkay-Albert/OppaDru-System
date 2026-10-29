<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Promo extends Model
{
    use HasFactory;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'code',
        'title',
        'description',
        'discount_type',
        'discount_value',
        'start_date',
        'end_date',
        'is_active',
        'image',
        'applicable_categories',
        'applicable_products',
        'min_order_amount',
        'max_discount_amount',
        'usage_limit',
        'times_used',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'is_active' => 'boolean',
        'applicable_categories' => 'array',
        'applicable_products' => 'array',
        'usage_limit' => 'integer',
        'times_used' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (Promo $promo) {
            if (empty($promo->id)) {
                $promo->id = 'OPPA-PRM-' . strtoupper(Str::random(8));
            }
            if (!empty($promo->code)) {
                $promo->code = strtoupper(trim($promo->code));
            }
        });

        static::updating(function (Promo $promo) {
            if (!empty($promo->code)) {
                $promo->code = strtoupper(trim($promo->code));
            }
        });

        static::saved(function () {
            \Illuminate\Support\Facades\Cache::forget('promos_active_list');
        });

        static::deleted(function () {
            \Illuminate\Support\Facades\Cache::forget('promos_active_list');
        });
    }

    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query->where('is_active', true)
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('start_date')
                    ->orWhere('start_date', '<=', $now);
            })
            ->where(function (Builder $q) use ($now) {
                $q->whereNull('end_date')
                    ->orWhere('end_date', '>=', $now);
            })
            ->where(function (Builder $q) {
                $q->whereNull('usage_limit')
                    ->orWhereColumn('times_used', '<', 'usage_limit');
            });
    }

    public function isValidForSubtotal(float $subtotal): bool
    {
        $now = now();
        if (!$this->is_active) {
            return false;
        }
        if ($this->start_date && $this->start_date->isFuture()) {
            return false;
        }
        if ($this->end_date && $this->end_date->isPast()) {
            return false;
        }
        if ($this->usage_limit !== null && $this->times_used >= $this->usage_limit) {
            return false;
        }
        if ($subtotal < (float) $this->min_order_amount) {
            return false;
        }

        return true;
    }

    public function calculateDiscount(float $subtotal, array $items = []): float
    {
        if (!$this->isValidForSubtotal($subtotal)) {
            return 0.0;
        }

        $applicableCategories = is_array($this->applicable_categories) ? $this->applicable_categories : [];
        $applicableProducts = is_array($this->applicable_products) ? $this->applicable_products : [];

        $hasCategoryFilter = !empty($applicableCategories);
        $hasProductFilter = !empty($applicableProducts);

        $eligibleSubtotal = $subtotal;

        if (($hasCategoryFilter || $hasProductFilter) && !empty($items)) {
            $filteredSubtotal = 0.0;
            foreach ($items as $item) {
                $productId = (string) ($item['product_id'] ?? $item['id'] ?? '');
                $category = strtolower((string) ($item['category'] ?? ''));
                $price = (float) ($item['product_price'] ?? $item['price'] ?? 0);
                $qty = (int) ($item['quantity'] ?? 1);

                $matchesProduct = $hasProductFilter && in_array($productId, $applicableProducts, true);
                $matchesCategory = $hasCategoryFilter && in_array($category, array_map('strtolower', $applicableCategories), true);

                if ($matchesProduct || $matchesCategory) {
                    $filteredSubtotal += $price * $qty;
                }
            }

            if ($filteredSubtotal <= 0) {
                return 0.0;
            }
            $eligibleSubtotal = $filteredSubtotal;
        }

        if ($this->discount_type === 'percent') {
            $discount = round($eligibleSubtotal * ((float) $this->discount_value / 100), 2);
            if ($this->max_discount_amount !== null && (float) $this->max_discount_amount > 0) {
                $discount = min($discount, (float) $this->max_discount_amount);
            }
            return min($discount, $eligibleSubtotal);
        }

        return min((float) $this->discount_value, $eligibleSubtotal);
    }
}

