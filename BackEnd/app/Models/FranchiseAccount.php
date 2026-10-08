<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FranchiseAccount extends Model
{
    protected $table = 'franchise_accounts';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'slug',
        'email',
        'phone',
        'address',
        'status',
        'owner_admin_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (self $account) {
            $account->id ??= 'OPPA-FA-'.strtoupper(Str::random(8));
            $account->slug ??= Str::slug($account->name ?: 'franchise');
        });
    }

    public function locations()
    {
        return $this->hasMany(Franchise::class, 'franchise_account_id', 'id');
    }

    public function managers()
    {
        return $this->hasMany(FranchiseUser::class, 'franchise_account_id', 'id');
    }
}
