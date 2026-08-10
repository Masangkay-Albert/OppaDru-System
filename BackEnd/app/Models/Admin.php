<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Admin extends Model
{
    protected $table = 'admin';

    protected $fillable = [
        'full_name',
        'email',
        'password',
        'api_token',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];
}
