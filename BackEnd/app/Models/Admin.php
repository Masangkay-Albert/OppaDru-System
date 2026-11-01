<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Admin extends Model
{
    protected $table = 'admin';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_SYSTEM_ADMINISTRATOR = 'system_administrator';

    protected $attributes = [
        'role' => self::ROLE_ADMIN,
    ];

    protected $fillable = [
        'full_name',
        'email',
        'password',
        'api_token',
        'role',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];
}
