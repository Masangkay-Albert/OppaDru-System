<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Announcement extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'title',
        'content',
        'target_audience',
        'target_audiences',
        'image_url',
        'image_path',
        'priority',
        'status',
        'date_sent',
        'scheduled_at',
        'author_name',
        'author_id',
        'metadata',
    ];

    protected $casts = [
        'target_audiences' => 'array',
        'metadata' => 'array',
        'date_sent' => 'datetime',
        'scheduled_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = 'ann-' . strtoupper(Str::random(8));
            }
            if (empty($model->date_sent) && $model->status === 'published') {
                $model->date_sent = now();
            }
        });
    }

    public function scopeForAudience($query, string $audience)
    {
        if ($audience === 'all') {
            return $query;
        }

        return $query->where(function ($q) use ($audience) {
            $q->where('target_audience', 'all')
              ->orWhere('target_audience', $audience)
              ->orWhereJsonContains('target_audiences', $audience);
        });
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published')
                     ->where(function ($q) {
                         $q->whereNull('date_sent')
                           ->orWhere('date_sent', '<=', now()->addMinutes(5));
                     });
    }
}
