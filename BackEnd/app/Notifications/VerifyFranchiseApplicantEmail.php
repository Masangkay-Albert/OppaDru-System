<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyFranchiseApplicantEmail extends Notification
{
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verificationUrl = URL::temporarySignedRoute(
            'franchise-applicant.verification.verify',
            now()->addHour(),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
        );

        return (new MailMessage)
            ->subject('Verify your Oppa Dru franchise applicant account')
            ->greeting('Welcome to the Oppa Dru Franchise Partner Portal!')
            ->line('Please verify your email address to access and track your franchise application.')
            ->action('Verify Email Address', $verificationUrl)
            ->line('This verification link expires in 60 minutes.');
    }
}
