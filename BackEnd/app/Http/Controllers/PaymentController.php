<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use App\Services\PricingService;

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

    public function createGCashPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'items' => 'required|array|min:1',
            'delivery_type' => 'nullable|string|in:standard,priority',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $pricing = app(PricingService::class)->calculate($request->items, $request->input('delivery_type', 'standard'), (float) $request->input('voucher_discount', 0), (float) $request->input('discount_rate', 0), $request->input('delivery_coordinates'));
        if (round((float) $request->amount, 2) !== $pricing['total']) return response()->json(['success' => false, 'message' => 'The checkout total has changed. Please review your order.'], 422);
        $amount = $pricing['total'];
        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey) {
            $payment = \App\Models\Payment::create([
                'reference' => $this->generateReferenceNumber(),
                'provider' => 'sandbox',
                'amount' => $amount,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(5),
                'metadata' => [
                    'sandbox' => true,
                    'checkout_url' => null,
                ],
            ]);

            return response()->json([
                'success' => true,
                'reference' => $payment->reference,
                'checkout_url' => null,
                'expires_at' => $payment->expires_at?->toISOString(),
                'amount' => (float) $payment->amount,
            ], 201);
        }

        $reference = $this->generateReferenceNumber();
        $amountInCentavos = (int) round($amount * 100);
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->post(config('services.paymongo.base_url') . '/sources', [
                'data' => [
                    'attributes' => [
                        'amount' => $amountInCentavos,
                        'currency' => 'PHP',
                        'type' => 'gcash',
                        'redirect' => [
                            'success' => rtrim(config('app.frontend_url'), '/') . '/payment/confirm/' . $reference,
                            'failed' => rtrim(config('app.frontend_url'), '/') . '/payment/confirm/' . $reference,
                        ],
                    ],
                ],
            ]);

        if ($response->failed()) {
            Log::error('Unable to create PayMongo GCash source', ['status' => $response->status(), 'body' => $response->json()]);
            return response()->json(['success' => false, 'message' => 'Unable to start GCash payment.'], 502);
        }

        $source = $response->json('data');
        $attributes = $source['attributes'] ?? [];
        $payment = \App\Models\Payment::create([
            'reference' => $reference,
            'provider_id' => $source['id'],
            'amount' => $amount,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
            'metadata' => [
                'source_status' => $attributes['status'] ?? 'pending',
                'checkout_url' => $attributes['redirect']['checkout_url'] ?? null,
            ],
        ]);

        return response()->json([
            'success' => true,
            'reference' => $payment->reference,
            'checkout_url' => $attributes['redirect']['checkout_url'] ?? null,
            'expires_at' => $payment->expires_at?->toISOString(),
            'amount' => (float) $payment->amount,
        ], 201);
    }

    /**
     * Request OTP for GCash payment
     */
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

    /**
     * Verify GCash OTP and process payment
     */
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

    /**
     * Process credit card payment
     */
    public function processCard(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'card_number' => 'required|string',
            'card_holder_name' => 'required|string|min:2',
            'expiry_month' => 'required|string|size:2',
            'expiry_year' => 'required|string|size:4',
            'cvv' => 'required|string|min:3|max:4',
            'amount' => 'required|numeric|min:0.01',
            'items' => 'required|array|min:1',
            'delivery_type' => 'nullable|string|in:standard,priority',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
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

        $pricing = app(PricingService::class)->calculate($request->items, $request->input('delivery_type', 'standard'), (float) $request->input('voucher_discount', 0), (float) $request->input('discount_rate', 0), $request->input('delivery_coordinates'));
        if (round((float) $request->amount, 2) !== $pricing['total']) {
            return response()->json(['success' => false, 'message' => 'The checkout total has changed. Please review your order.'], 422);
        }

        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey || !str_starts_with($secretKey, 'sk_test_')) {
            return response()->json(['success' => false, 'message' => 'Card sandbox payments are not configured.'], 503);
        }

        $reference = $this->generateReferenceNumber();
        $headers = Http::withBasicAuth($secretKey, '')->acceptJson();
        $intent = $headers->post(config('services.paymongo.base_url') . '/payment_intents', ['data' => ['attributes' => ['amount' => (int) round($pricing['total'] * 100), 'currency' => 'PHP', 'payment_method_allowed' => ['card']]]]);
        if ($intent->failed()) return response()->json(['success' => false, 'message' => 'Unable to start card payment.'], 502);
        $method = $headers->post(config('services.paymongo.base_url') . '/payment_methods', ['data' => ['attributes' => ['type' => 'card', 'details' => ['card_number' => $cardNumber, 'exp_month' => (int) $request->expiry_month, 'exp_year' => (int) $request->expiry_year, 'cvc' => $request->cvv]]]]);
        if ($method->failed()) return response()->json(['success' => false, 'message' => 'Card details were rejected by the sandbox.'], 400);
        $attached = $headers->post(config('services.paymongo.base_url') . '/payment_intents/' . $intent->json('data.id') . '/attach', ['data' => ['attributes' => ['payment_method' => $method->json('data.id')]]]);
        $status = $attached->json('data.attributes.status');
        $payment = \App\Models\Payment::create(['reference' => $reference, 'provider' => 'paymongo_test', 'provider_id' => $intent->json('data.id'), 'amount' => $pricing['total'], 'status' => $status === 'succeeded' ? 'paid' : 'failed', 'paid_at' => $status === 'succeeded' ? now() : null, 'failure_reason' => $status === 'succeeded' ? null : 'PayMongo sandbox declined the card.', 'metadata' => ['sandbox' => true, 'payment_method_id' => $method->json('data.id')]]);
        return response()->json(['success' => $status === 'succeeded', 'transaction_id' => $intent->json('data.id'), 'reference_number' => $payment->reference, 'message' => $status === 'succeeded' ? 'Payment successful.' : 'Card declined by the sandbox.', 'timestamp' => now()->toISOString(), 'payment_method' => 'credit_card', 'amount' => (float) $payment->amount], $status === 'succeeded' ? 200 : 400);
    }

    /**
     * Verify QR payment (legacy method)
     */
    public function verifyQRPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'qr_data' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $this->simulateDelay(600, 1200);

        $qrData = $request->qr_data;
        $isValidQR = stripos($qrData, 'GCASH') !== false;

        if (!$isValidQR) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid QR code. Please scan a valid GCash QR code.',
                'timestamp' => now()->toISOString(),
                'payment_method' => 'gcash',
                'amount' => (float) $request->amount
            ], 400);
        }

        $success = mt_rand(1, 100) <= 92;

        if ($success) {
            Log::info('GCash QR payment successful', [
                'qr_data' => $qrData,
                'amount' => $request->amount,
                'user_id' => $request->user()?->id
            ]);

            return response()->json([
                'success' => true,
                'transaction_id' => 'QR-' . time(),
                'reference_number' => $this->generateReferenceNumber(),
                'message' => 'GCash QR payment successful!',
                'timestamp' => now()->toISOString(),
                'payment_method' => 'gcash',
                'amount' => (float) $request->amount
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'QR payment failed. Please try again.',
            'timestamp' => now()->toISOString(),
            'payment_method' => 'gcash',
            'amount' => (float) $request->amount
        ], 400);
    }

    /**
     * Confirm QR payment from mobile
     */
    public function confirmQRPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reference_number' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $this->simulateDelay(600, 1200);

        $success = mt_rand(1, 100) <= 92;

        if ($success) {
            Log::info('GCash QR payment confirmed', [
                'reference_number' => $request->reference_number,
                'amount' => $request->amount,
                'user_id' => $request->user()?->id
            ]);

            return response()->json([
                'success' => true,
                'transaction_id' => 'QR-' . time(),
                'reference_number' => $this->generateReferenceNumber(),
                'message' => 'GCash payment confirmed!',
                'timestamp' => now()->toISOString(),
                'payment_method' => 'gcash',
                'amount' => (float) $request->amount
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Payment verification failed. Please try again.',
            'timestamp' => now()->toISOString(),
            'payment_method' => 'gcash',
            'amount' => (float) $request->amount
        ], 400);
    }

    /**
     * Get order by reference for payment confirmation page
     */
    public function getOrderByReference($reference)
    {
        $payment = \App\Models\Payment::where('reference', $reference)->firstOrFail();
        $order = $payment->order;

        return response()->json([
            'success' => true,
            'order' => [
                'merchant' => 'Oppa Dru Korean Fried Chicken',
                'amount' => (float) $payment->amount,
                'reference' => $reference,
                'status' => $payment->status,
                'checkout_url' => $payment->metadata['checkout_url'] ?? null,
                'order_id' => $order?->id,
            ]
        ]);
    }

    /**
     * Confirm payment from mobile app/web after user clicks confirm
     * This is the main endpoint called from the payment confirmation page
     */
    public function confirmPaymentFromMobile($reference)
    {
        try {
            $payment = \App\Models\Payment::where('reference', $reference)->firstOrFail();

            if ($payment->status === 'pending' && $payment->expires_at?->isPast()) {
                $payment->update(['status' => 'expired']);
            }

            if ($payment->status !== 'pending') {
                return response()->json([
                    'success' => $payment->status === 'paid',
                    'message' => $payment->status === 'paid'
                        ? 'Payment was already confirmed.'
                        : 'Payment cannot be confirmed in its current state.',
                    'reference_number' => $reference,
                    'status' => $payment->status,
                    'amount' => (float) $payment->amount,
                ], $payment->status === 'paid' ? 200 : 422);
            }

            DB::transaction(function () use ($payment) {
                $payment->update([
                    'status' => 'paid',
                    'paid_at' => now(),
                ]);

                if ($payment->order) {
                    $payment->order->update([
                        'payment_status' => 'paid',
                        'status' => 'pending',
                    ]);
                }
            });
            
            Log::info('GCash QR payment confirmed via mobile scan', [
                'reference' => $reference,
                'timestamp' => now()->toISOString()
            ]);

            // Optionally update order status in database
            // $order = Order::where('reference_number', $reference)->first();
            // if ($order) {
            //     $order->payment_status = 'paid';
            //     $order->save();
            // }

            return response()->json([
                'success' => true,
                'message' => 'Payment confirmed successfully!',
                'reference_number' => $reference,
                'status' => 'paid',
                'amount' => (float) $payment->amount,
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('Error confirming payment', [
                'reference' => $reference,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to confirm payment: ' . $e->getMessage(),
                'reference_number' => $reference
            ], 500);
        }
    }

    /**
     * Get payment status for polling
     */
    public function getPaymentStatus($reference)
    {
        try {
            $payment = \App\Models\Payment::where('reference', $reference)->firstOrFail();
            if ($payment->status === 'pending' && $payment->expires_at?->isPast()) {
                $payment->update(['status' => 'expired']);
            }

            return response()->json([
                'confirmed' => $payment->status === 'paid',
                'status' => $payment->status,
                'reference' => $reference,
                'amount' => (float) $payment->amount,
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting payment status', [
                'reference' => $reference,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'confirmed' => false,
                'status' => 'error',
                'message' => 'Failed to get payment status'
            ], 500);
        }
    }

    /**
     * Get payment history for authenticated user
     */
    public function getPaymentHistory(Request $request)
    {
        // You can fetch payment history from database here
        // $payments = Payment::where('user_id', $request->user()->id)->get();
        
        return response()->json([
            'success' => true,
            'payments' => [
                // Example payment history data
                // [
                //     'id' => 1,
                //     'reference' => 'OPPA-123456-7890',
                //     'amount' => 1031.52,
                //     'status' => 'paid',
                //     'method' => 'gcash',
                //     'created_at' => now()->toISOString()
                // ]
            ],
            'message' => 'Payment history retrieved successfully.'
        ]);
    }

    /**
     * Webhook endpoint for GCash callback (if needed)
     */
    public function webhook(Request $request)
    {
        $signature = $request->header('Paymongo-Signature', '');
        $secret = config('services.paymongo.webhook_secret');
        if (!$secret || !$this->validPayMongoSignature($request->getContent(), $signature, $secret)) {
            return response()->json(['message' => 'Invalid webhook signature.'], 401);
        }

        $event = $request->json()->all();
        $eventType = data_get($event, 'data.attributes.type');
        $eventData = data_get($event, 'data.attributes.data', []);
        $providerId = data_get($eventData, 'id');
        $attributes = data_get($eventData, 'attributes', []);
        $payment = \App\Models\Payment::where('provider_id', $providerId)->first();
        if (!$payment && $providerId) {
            $payment = \App\Models\Payment::whereNotNull('metadata')->get()->first(
                fn ($candidate) => data_get($candidate->metadata, 'charge_id') === $providerId
            );
        }

        if (!$payment) {
            return response()->json(['status' => 'ignored']);
        }

        if ($eventType === 'source.chargeable') {
            $chargeId = data_get($payment->metadata, 'charge_id');
            if (!$chargeId) {
                $chargeResponse = Http::withBasicAuth(config('services.paymongo.secret_key'), '')
                    ->acceptJson()
                    ->post(config('services.paymongo.base_url') . '/payments', [
                        'data' => [
                            'attributes' => [
                                'amount' => (int) round((float) $payment->amount * 100),
                                'currency' => 'PHP',
                                'description' => 'Oppa Dru GCash payment ' . $payment->reference,
                                'source' => ['id' => $payment->provider_id, 'type' => 'source'],
                            ],
                        ],
                    ]);

                if ($chargeResponse->successful()) {
                    $payment->update(['metadata' => array_merge($payment->metadata ?? [], [
                        'charge_id' => $chargeResponse->json('data.id'),
                    ])]);
                } else {
                    Log::error('Unable to charge PayMongo GCash source', ['reference' => $payment->reference, 'body' => $chargeResponse->json()]);
                }
            }
        }

        DB::transaction(function () use ($payment, $eventType, $attributes) {
            if ($payment->status === 'paid') {
                return;
            }

            $newStatus = match ($eventType) {
                'payment.paid' => 'paid',
                'source.failed', 'payment.failed' => 'failed',
                'source.expired', 'payment.expired' => 'expired',
                default => null,
            };

            if (!$newStatus) {
                return;
            }

            $payment->update([
                'status' => $newStatus,
                'paid_at' => $newStatus === 'paid' ? now() : null,
                'failure_reason' => $newStatus === 'failed' ? ($attributes['failure_code'] ?? 'Payment failed') : null,
            ]);

            if ($payment->order) {
                $payment->order->update([
                    'payment_status' => $newStatus,
                    'status' => $newStatus === 'paid' ? 'pending' : $payment->order->status,
                ]);
            }
        });
        
        return response()->json(['status' => 'success']);
    }

    private function validPayMongoSignature(string $payload, string $header, string $secret): bool
    {
        $parts = collect(explode(',', $header))->mapWithKeys(function ($part) {
            [$key, $value] = array_pad(explode('=', $part, 2), 2, null);
            return [$key => $value];
        });
        $timestamp = $parts->get('t');
        $signature = $parts->get('te') ?: $parts->get('li');
        if (!$timestamp || !$signature || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        return hash_equals($signature, hash_hmac('sha256', $timestamp . '.' . $payload, $secret));
    }
}