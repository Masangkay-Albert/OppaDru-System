<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class Driver extends Authenticatable
{
    use HasFactory, Notifiable;

    // Primary key settings
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    // Fields that can be mass assigned
    protected $fillable = [
        'id',             // Maps to your frontend '_id'
        'franchise_id',
        'name',
        'email',
        'password',
        'phone',
        'vehicleType',
        'isActive',
    ];

    // Hidden fields
    protected $hidden = [
        'password',
        'remember_token',
    ];

    // Automatically cast data types
    protected $casts = [
        'password' => 'hashed',
        'isActive' => 'boolean', // Ensures 1/0 in DB becomes true/false in React
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($driver) {
            // Generate ID if none was provided
            if (empty($driver->id)) {
                $slug = Str::upper(
                    Str::slug($driver->name ?: 'driver', '')
                );

                // Keep only letters and numbers
                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);

                // Limit name part to 16 characters
                $slug = substr($slug, 0, 16);

                // Generate ID (e.g., OPPA-DRV-JOHNDOE-A1B2)
                $driver->id =
                    'OPPA-DRV-' .
                    ($slug ?: 'DRV') .
                    '-' .
                    strtoupper(Str::random(4));
            }
        });
    }

    public function franchise()
    {
        return $this->belongsTo(Franchise::class, 'franchise_id', 'id');
    }
}