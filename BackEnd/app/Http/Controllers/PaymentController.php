<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    private function generateReferenceNumber(): string
    {
        return 'OPPA-PAY-' . date('Ymd') . '-' . strtoupper(Str::random(8));
    }

    private function generateOTP(): string
    {
        return str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function validateMobileNumber(string $mobile): bool
    {
        return preg_match('/^(09|\+639)\d{9}$/', preg_replace('/\s/', '', $mobile)) === 1;
    }

    private function validateCardNumber(string $card): bool
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

    private function isCardExpired(string $month, string $year): bool
    {
        $now = new \DateTime();
        $expYear = (int) $year;
        $expMonth = (int) $month;
        return ($expYear < (int) $now->format('Y')) ||
               ($expYear === (int) $now->format('Y') && $expMonth < (int) $now->format('m'));
    }

    private function simulateDelay(int $min = 800, int $max = 2000): void
    {
        usleep(($min + mt_rand(0, $max - $min)) * 1000);
    }

    public function requestGCashOTP(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'mobile_number' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $mobile = preg_replace('/\s/', '', $request->mobile_number);

        if (!$this->validateMobileNumber($mobile)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid Philippine mobile number. Use format 09XXXXXXXXX.'
            ], 400);
        }

        $this->simulateDelay(500, 1000);

        $otp = $this->generateOTP();

        Log::info('GCash OTP generated', [
            'mobile' => $mobile,
            'otp' => $otp,
            'user_id' => $request->user()?->id
        ]);

        return response()->json([
            'success' => true,
            'otp' => $otp,
            'message' => "A 6-digit code was sent to {$mobile}.",
            'expires_in' => 300
        ]);
    }

    public function verifyGCash(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'mobile_number' => 'required|string',
            'otp' => 'required|string|size:6',
            'amount' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $this->simulateDelay(600, 1500);

        $success = mt_rand(1, 100) <= 92;

        if ($success) {
            return response()->json([
                'success' => true,
                'transaction_id' => 'GCASH-' . time(),
                'reference_number' => $this->generateReferenceNumber(),
                'message' => 'Payment successful!',
                'timestamp' => now()->toISOString(),
                'payment_method' => 'gcash',
                'amount' => (float) $request->amount
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Payment failed. Please try again.',
            'timestamp' => now()->toISOString(),
            'payment_method' => 'gcash',
            'amount' => (float) $request->amount
        ], 400);
    }

    public function processCard(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'card_number' => 'required|string',
            'card_holder_name' => 'required|string|min:2',
            'expiry_month' => 'required|string|size:2',
            'expiry_year' => 'required|string|size:4',
            'cvv' => 'required|string|min:3|max:4',
            'amount' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $cardNumber = preg_replace('/\s/', '', $request->card_number);

        if (!$this->validateCardNumber($cardNumber)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid card number.'
            ], 400);
        }

        if ($this->isCardExpired($request->expiry_month, $request->expiry_year)) {
            return response()->json([
                'success' => false,
                'message' => 'Card has expired.'
            ], 400);
        }

        $this->simulateDelay(800, 2000);

        $success = mt_rand(1, 100) <= 88;

        if ($success) {
            $masked = '****' . substr($cardNumber, -4);
            return response()->json([
                'success' => true,
                'transaction_id' => 'CARD-' . time(),
                'reference_number' => $this->generateReferenceNumber(),
                'message' => "Payment successful! Card ending in {$masked}",
                'timestamp' => now()->toISOString(),
                'payment_method' => 'credit_card',
                'amount' => (float) $request->amount
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Card declined. Please try again.',
            'timestamp' => now()->toISOString(),
            'payment_method' => 'credit_card',
            'amount' => (float) $request->amount
        ], 400);
    }

    public function getPaymentHistory(Request $request)
    {
        return response()->json([
            'payments' => [],
            'message' => 'Payment history feature coming soon.'
        ]);
    }
}