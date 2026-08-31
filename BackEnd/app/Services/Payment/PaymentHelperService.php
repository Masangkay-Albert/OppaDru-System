<?php

namespace App\Services\Payment;

class PaymentHelperService
{
    public function generateReferenceNumber(): string
    {
        return 'OPPA-PAY-' . date('Ymd') . '-' . strtoupper(\Illuminate\Support\Str::random(8));
    }

    public function generateOTP(): string
    {
        return str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    }

    public function validateMobileNumber(string $mobile): bool
    {
        return preg_match('/^(09|\+639)\d{9}$/', preg_replace('/\s/', '', $mobile)) === 1;
    }

    public function validateCardNumber(string $card): bool
    {
        $clean = preg_replace('/\s/', '', $card);
        if (!preg_match('/^\d{16}$/', $clean)) {
            return false;
        }

        $sum = 0;
        $isEven = false;

        for ($i = strlen($clean) - 1; $i >= 0; $i--) {
            $digit = (int) $clean[$i];
            if ($isEven) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }

            $sum += $digit;
            $isEven = !$isEven;
        }

        return $sum % 10 === 0;
    }

    public function isCardExpired(string $month, string $year): bool
    {
        $now = new \DateTime();
        $expYear = (int) $year;
        $expMonth = (int) $month;

        return ($expYear < (int) $now->format('Y'))
            || ($expYear === (int) $now->format('Y') && $expMonth < (int) $now->format('m'));
    }

    public function buildPaymentPayload(bool $success, string $message, float $amount, string $paymentMethod = 'gcash', ?string $referenceNumber = null, ?string $transactionId = null): array
    {
        return [
            'success' => $success,
            'message' => $message,
            'timestamp' => now()->toISOString(),
            'payment_method' => $paymentMethod,
            'amount' => (float) $amount,
            'reference_number' => $referenceNumber,
            'transaction_id' => $transactionId,
        ];
    }
}
