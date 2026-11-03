<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory;
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_id',
        'name',
        'description',
        'price',
        'category',
        'image',
        'is_available',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_available' => 'boolean',
    ];

    public function getImageAttribute(?string $value): ?string
    {
        if (is_string($value)) {
            if (str_starts_with($value, 'data:image/')) {
                $version = substr(hash('sha256', $value), 0, 16);
                $branchQuery = $this->getAttribute('franchise_id')
                    ? '?franchise_id='.urlencode((string) $this->getAttribute('franchise_id')).'&'
                    : '?';

                return url('/api/products/'.$this->getKey().'/image').$branchQuery.'v='.$version;
            }

            if (str_starts_with($value, '/api/')) {
                return url($value);
            }
        }

        return $value;
    }

    /**
     * Scope query to select lightweight columns, replacing heavy base64 image data
     * with an endpoint URL directly in SQL to minimize Supabase egress.
     */
    public function scopeWithCatalogColumns($query)
    {
        $imageColumn = \Illuminate\Support\Facades\DB::getDriverName() === 'sqlite'
            ? 'image'
            : \Illuminate\Support\Facades\DB::raw("CASE WHEN image LIKE 'data:image%' THEN CONCAT('/api/products/', id, '/image?', CASE WHEN franchise_id IS NOT NULL THEN CONCAT('franchise_id=', franchise_id, '&') ELSE '' END, 'v=', SUBSTRING(MD5(image), 1, 16)) ELSE image END AS image");

        return $query->select([
            'id',
            'franchise_id',
            'name',
            'description',
            'price',
            'category',
            'is_available',
            'created_at',
            'updated_at',
            'deleted_at',
            $imageColumn,
        ]);
    }

    public static function clearCatalogCache(): void
    {
        \Illuminate\Support\Facades\Cache::forget('catalog_products_all');
        \Illuminate\Support\Facades\Cache::forget('catalog_products_global');
        \Illuminate\Support\Facades\Cache::forget('catalog_products_available');
        // Clear category caches
        $categories = ['chicken', 'rice-meals', 'burgers', 'drinks', 'sides', 'noodles', 'combos'];
        foreach ($categories as $cat) {
            \Illuminate\Support\Facades\Cache::forget("catalog_products_cat_{$cat}");
        }
    }

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $slug = Str::upper(Str::slug($model->name ?: 'food-item', ''));
                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);
                $slug = substr($slug, 0, 20);
                $model->id = 'OPPA-PROD-' . ($slug ?: 'ITEM') . '-' . strtoupper(Str::random(4));
            }
        });
        static::saved(function () {
            static::clearCatalogCache();
        });
        static::deleted(function () {
            static::clearCatalogCache();
        });
    }

    public function addonGroups()
    {
        return $this->belongsToMany(AddonGroup::class, 'product_addon_groups', 'product_id', 'addon_group_id');
    }
}