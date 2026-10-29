<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyUserEmail;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class User extends Authenticatable implements MustVerifyEmail
{
    use CanResetPassword, HasFactory, Notifiable;

    public $incrementing = false;
    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'id',
        'full_name',
        'email',
        'phone',
        'password',
        'role',
        'api_token',
        'email_verified_at',
        'security_question',
        'security_answer_hash',
    ];

    protected $hidden = [
        'password',
        'api_token',
        'security_answer_hash',
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

    public function sendPasswordResetNotification($token): void
    {
        $this->sendNotificationWithFallback(new ResetPasswordNotification($token));
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->sendNotificationWithFallback(new VerifyUserEmail());
    }

    protected function sendNotificationWithFallback(Notification $notification): void
    {
        $primaryMailer = config('mail.default');
        $smtpConfigured = !empty(config('mail.mailers.smtp.username')) && !empty(config('mail.mailers.smtp.password'));

        if ($primaryMailer === 'gmail_api' && $smtpConfigured) {
            config()->set('mail.default', 'smtp');
        }

        try {
            try {
                $this->notify($notification);
            } catch (\Throwable $e) {
                if (!$smtpConfigured) {
                    Log::warning('Mail notification failed without SMTP fallback.', [
                        'user_id' => $this->id,
                        'notification' => get_class($notification),
                        'exception_class' => get_class($e),
                        'exception_message' => $e->getMessage(),
                    ]);

                    throw $e;
                }

                config()->set('mail.default', 'smtp');

                try {
                    $this->notify($notification);
                } catch (\Throwable $fallbackException) {
                    Log::warning('Mail notification failed after SMTP fallback.', [
                        'user_id' => $this->id,
                        'notification' => get_class($notification),
                        'exception_class' => get_class($fallbackException),
                        'exception_message' => $fallbackException->getMessage(),
                    ]);

                    throw $fallbackException;
                }
            }
        } finally {
            config()->set('mail.default', $primaryMailer);
        }
    }
}