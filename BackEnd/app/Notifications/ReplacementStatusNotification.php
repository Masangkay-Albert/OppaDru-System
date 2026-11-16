<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReplacementStatusNotification extends Notification
{
    public function __construct(
        private readonly string $orderNumber,
        private readonly string $status,
        private readonly ?string $reason = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Update about your Oppa Dru replacement')
            ->greeting('Hello '.($notifiable->full_name ?? 'Customer').'!')
            ->line('There is an update for your replacement request on order '.$this->orderNumber.'.');

        $statusMessage = match ($this->status) {
            'pending' => 'Waiting for review.',
            'approved' => 'Your replacement is being prepared.',
            'replacement_sent' => 'Your replacement is on the way. You do not need to return the food.',
            'rejected' => 'Your request was not approved.',
            'replaced' => 'Your replacement has been delivered.',
            default => 'Your replacement request has been updated.',
        };
        $message->line($statusMessage);

        if ($this->reason) {
            $message->line('Reason: '.$this->reason);
        }

        return $message->line('Thank you for letting us know.');
    }
}
