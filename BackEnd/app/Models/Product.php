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

                return url('/api/products/'.$this->getKey().'/image').'?v='.$version;
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
            \Illuminate\Support\Facades\DB::raw("CASE WHEN image LIKE 'data:image%' THEN CONCAT('/api/products/', id, '/image?v=', SUBSTRING(MD5(image), 1, 16)) ELSE image END AS image")
        ]);
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
    }

    public function addonGroups()
    {
        return $this->belongsToMany(AddonGroup::class, 'product_addon_groups', 'product_id', 'addon_group_id');
    }
}