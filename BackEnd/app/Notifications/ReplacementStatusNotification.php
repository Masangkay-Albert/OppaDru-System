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
        return ['database', 'mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->statusTitle(),
            'message' => $this->statusMessage(),
            'order_number' => $this->orderNumber,
            'status' => $this->status,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Update about your Oppa Dru replacement')
            ->greeting('Hello '.($notifiable->full_name ?? 'Customer').'!')
            ->line('There is an update for your replacement request on order '.$this->orderNumber.'.');

        return $message->line($this->statusMessage())->line('Thank you for letting us know.');
    }

    private function statusTitle(): string
    {
        return match ($this->status) {
            'pending' => 'Replacement request received',
            'approved' => 'Your replacement is being prepared',
            'replacement_sent' => 'Your replacement is on the way',
            'rejected' => 'Replacement request not approved',
            'replaced' => 'Your replacement has been delivered',
            default => 'Replacement request update',
        };
    }

    private function statusMessage(): string
    {
        $message = match ($this->status) {
            'pending' => 'Your replacement request for order '.$this->orderNumber.' was received and is waiting for review.',
            'approved' => 'The replacement for your order '.$this->orderNumber.' is being prepared by the branch.',
            'replacement_sent' => 'The replacement for your order '.$this->orderNumber.' is on the way. You do not need to return the food.',
            'rejected' => 'Your replacement request for order '.$this->orderNumber.' was not approved.',
            'replaced' => 'The replacement for your order '.$this->orderNumber.' has been delivered.',
            default => 'Your replacement request for order '.$this->orderNumber.' has been updated.',
        };

        return $this->reason ? $message.' Reason: '.$this->reason : $message;
    }
}
