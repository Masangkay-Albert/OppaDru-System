<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class DiscountApplicationDecisionMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $discountType,
        public string $status,
        public ?string $rejectionReason = null,
        public ?string $customerName = null,
    ) {}

    public function build(): self
    {
        $statusLabel = strtolower($this->status) === 'approved' ? 'approved' : 'not approved';
        $subject = 'Your Oppa Dru discount request was ' . $statusLabel;

        $message = $this->subject($subject)
            ->markdown('emails.discount-application-decision', [
                'discountType' => $this->discountType,
                'status' => $this->status,
                'customerName' => $this->customerName ?? 'Customer',
                'rejectionReason' => $this->rejectionReason,
            ]);

        return $message;
    }
}
