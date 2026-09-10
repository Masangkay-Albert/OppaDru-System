<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Notifications\Notifiable;
use App\Notifications\VerifyUserEmail;
use Illuminate\Support\Str;

class User extends Authenticatable implements MustVerifyEmail
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
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'email_verified_at' => 'datetime',
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
            
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }

    public function sendEmailVerificationNotification(): void
    {
        $primaryMailer = config('mail.default');
        $smtpConfigured = !empty(config('mail.mailers.smtp.username')) && !empty(config('mail.mailers.smtp.password'));

        try {
            $this->notify(new VerifyUserEmail());
            return;
        } catch (\Throwable $e) {
            if (!$smtpConfigured) {
                throw $e;
            }

            config()->set('mail.default', 'smtp');

            try {
                $this->notify(new VerifyUserEmail());
            } finally {
                config()->set('mail.default', $primaryMailer);
            }
        }
    }
}