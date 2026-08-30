<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class Employee extends Authenticatable
{
    use HasFactory, Notifiable;

    // Primary key settings
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

 

    // Fields that can be mass assigned
    protected $fillable = [
        'id',
        'fullName',
        'email',
        'password',
        'position',
    ];

    // Hidden fields
    protected $hidden = [
        'password',
        'remember_token',
    ];

    // Automatically hash password
    protected $casts = [
        'password' => 'hashed',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($employee) {
            // Generate employee ID if none was provided
            if (empty($employee->id)) {
                $slug = Str::upper(
                    Str::slug($employee->fullName ?: 'employee', '')
                );

                // Keep only letters and numbers
                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);

                // Limit name part to 16 characters
                $slug = substr($slug, 0, 16);

                // Generate ID
                $employee->id =
                    'OPPA-EMP-' .
                    ($slug ?: 'EMP') .
                    '-' .
                    strtoupper(Str::random(4));
            }
        });
    }
}