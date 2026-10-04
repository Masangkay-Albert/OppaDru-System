<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class Employee extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'franchise_id',
        'fullName',
        'email',
        'password',
        'position',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'is_active' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($employee) {
            if (empty($employee->id)) {
                $slug = Str::upper(
                    Str::slug($employee->fullName ?: 'employee', '')
                );

                $slug = preg_replace('/[^A-Z0-9]/', '', $slug);

                $slug = substr($slug, 0, 16);

                $employee->id =
                    'OPPA-EMP-' .
                    ($slug ?: 'EMP') .
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