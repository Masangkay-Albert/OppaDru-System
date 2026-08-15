<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public $incrementing = false;
    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'id',
        'full_name',
        'email',
        'phone',
        'password',
        'api_token',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];

    protected $casts = [
        'password' => 'hashed',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $slug = Str::upper(Str::slug($model->full_name ?: 'customer', ''));
                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);
                $slug = substr($slug, 0, 16);
                $model->id = 'OPPA-USER-' . ($slug ?: 'CUST') . '-' . strtoupper(Str::random(4));
            }
            
            // Add this to manually set created_at
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }
}