<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class FranchiseUser extends Authenticatable
{
    use HasFactory, Notifiable;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'franchise_users';

    protected $fillable = [
        'id',
        'franchise_id',
        'full_name',
        'email',
        'phone',
        'password',
        'api_token',
        'is_active',
        'can_process_pos',
    ];

    protected $hidden = [
        'password',
        'api_token',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'is_active' => 'boolean',
        'can_process_pos' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $slug = Str::upper(Str::slug($model->full_name ?: 'franchise-user', ''));
                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);
                $slug = substr($slug, 0, 16);
                $model->id = 'OPPA-FRU-' . ($slug ?: 'FR') . '-' . strtoupper(Str::random(4));
            }
        });
    }

    public function franchise()
    {
        return $this->belongsTo(Franchise::class, 'franchise_id', 'id');
    }
}
