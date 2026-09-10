<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DiscountApplicationDecisionNotification extends Notification
{
    public function __construct(
        public string $discountType,
        public string $status,
        public ?string $rejectionReason = null,
        public ?string $customerName = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $statusLabel = strtolower($this->status) === 'approved' ? 'approved' : 'not approved';
        $message = (new MailMessage)
            ->subject('Your Oppa Dru discount request was ' . $statusLabel)
            ->greeting('Hello ' . ($this->customerName ?? $notifiable->full_name ?? 'Customer') . '!')
            ->line('Your ' . $this->discountType . ' discount request has been ' . $this->status . '.');

        if (strtolower($this->status) === 'approved') {
            $message->line('Your request has been accepted and the discount will be applied to eligible orders.');
        } else {
            $message->line('Your request was not approved for the following reason:')
                ->line($this->rejectionReason ?? 'No reason provided.');
        }

        return $message->line('Thank you for using Oppa Dru.');
    }
}
