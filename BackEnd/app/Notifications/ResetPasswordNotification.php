<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    public function __construct(public string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendBaseUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'https://oppa-dru-system.vercel.app')), '/');
        $resetUrl = $frontendBaseUrl . '/reset-password?token=' . urlencode($this->token) . '&email=' . urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset your Oppa Dru password')
            ->greeting('Hello!')
            ->line('We received a request to reset the password for your Oppa Dru account.')
            ->action('Reset Password', $resetUrl)
            ->line('This password reset link expires in 60 minutes.')
            ->line('If you did not request this password reset, you can safely ignore this email.');
    }
}
