<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use App\Services\Payment\PaymentHelperService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentHelperService $paymentHelper,
        private readonly PricingService $pricingService,
    ) {
    }

    private function validateAmount(Request $request): ?array
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'items' => 'required|array|min:1',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return ['success' => false, 'message' => $validator->errors()->first(), 'status' => 422];
        }

        try {
            $pricing = $this->pricingService->calculate(
                $request->items,
                $request->input('delivery_type', 'standard'),
                (float) $request->input('voucher_discount', 0),
                (float) $request->input('discount_rate', 0),
                $request->input('delivery_coordinates')
            );
            if (round((float) $request->amount) !== $pricing['total']) {
                return ['success' => false, 'message' => 'The checkout total has changed. Please review your order.', 'status' => 422];
            }

            return ['success' => true, 'amount' => $pricing['total']];
        } catch (\InvalidArgumentException $exception) {
            return ['success' => false, 'message' => $exception->getMessage(), 'status' => 422];
        }
    }

    public function createGCashPayment(Request $request)
    {
        $validated = $this->validateAmount($request);
        if (($validated['success'] ?? false) === false) {
            return response()->json(['success' => false, 'message' => $validated['message']], $validated['status'] ?? 422);
        }

        $amount = $validated['amount'];
        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey) {
            $payment = \App\Models\Payment::create([
                'reference' => $this->paymentHelper->generateReferenceNumber(),
                'provider' => 'sandbox',
                'amount' => $amount,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(5),
                'metadata' => ['sandbox' => true, 'checkout_url' => null],
            ]);

            return response()->json([
                'success' => true,
                'reference' => $payment->reference,
                'checkout_url' => null,
                'expires_at' => $payment->expires_at?->toISOString(),
                'amount' => (float) $payment->amount,
            ], 201);
        }

        $reference = $this->paymentHelper->generateReferenceNumber();
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->post(config('services.paymongo.base_url') . '/sources', [
                'data' => ['attributes' => [
                    'amount' => (int) round($amount * 100),
                    'currency' => 'PHP',
                    'type' => 'gcash',
                    'redirect' => ['success' => rtrim(config('app.frontend_url'), '/') . '/payment/confirm/' . $reference, 'failed' => rtrim(config('app.frontend_url'), '/') . '/payment/confirm/' . $reference],
                ]],
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
            'metadata' => ['source_status' => $attributes['status'] ?? 'pending', 'checkout_url' => $attributes['redirect']['checkout_url'] ?? null],
        ]);

        return response()->json([
            'success' => true,
            'reference' => $payment->reference,
            'checkout_url' => $attributes['redirect']['checkout_url'] ?? null,
            'expires_at' => $payment->expires_at?->toISOString(),
            'amount' => (float) $payment->amount,
        ], 201);
    }

    public function requestGCashOTP(Request $request)
    {
        $validator = Validator::make($request->all(), ['mobile_number' => 'required|string']);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $mobile = preg_replace('/\s/', '', $request->mobile_number);
        if (!$this->paymentHelper->validateMobileNumber($mobile)) {
            return response()->json(['success' => false, 'message' => 'Invalid Philippine mobile number. Use format 09XXXXXXXXX.'], 400);
        }

        usleep(500000);
        $otp = $this->paymentHelper->generateOTP();

        Log::info('GCash OTP generated', ['mobile' => $mobile, 'otp' => $otp, 'user_id' => $request->user()?->id]);

        return response()->json(['success' => true, 'otp' => $otp, 'message' => "A 6-digit code was sent to {$mobile}.", 'expires_in' => 300]);
    }

    public function verifyGCash(Request $request)
    {
        $validator = Validator::make($request->all(), ['mobile_number' => 'required|string', 'otp' => 'required|string|size:6', 'amount' => 'required|numeric|min:0.01']);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        usleep(600000);
        $success = mt_rand(1, 100) <= 92;

        return response()->json(
            $this->paymentHelper->buildPaymentPayload($success, $success ? 'Payment successful!' : 'Payment failed. Please try again.', (float) $request->amount, 'gcash', $success ? $this->paymentHelper->generateReferenceNumber() : null, $success ? 'GCASH-' . time() : null),
            $success ? 200 : 400
        );
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
            'items' => 'required|array|min:1',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $cardNumber = preg_replace('/\s/', '', $request->card_number);
        if (!$this->paymentHelper->validateCardNumber($cardNumber)) {
            return response()->json(['success' => false, 'message' => 'Invalid card number.'], 400);
        }
        if ($this->paymentHelper->isCardExpired($request->expiry_month, $request->expiry_year)) {
            return response()->json(['success' => false, 'message' => 'Card has expired.'], 400);
        }

        $pricing = $this->validateAmount($request);
        if (($pricing['success'] ?? false) === false) {
            return response()->json(['success' => false, 'message' => $pricing['message']], $pricing['status'] ?? 422);
        }

        $secretKey = config('services.paymongo.secret_key');
        if (!$secretKey || !str_starts_with($secretKey, 'sk_test_')) {
            return response()->json(['success' => false, 'message' => 'Card sandbox payments are not configured.'], 503);
        }

        $reference = $this->paymentHelper->generateReferenceNumber();
        $headers = Http::withBasicAuth($secretKey, '')->acceptJson();
        $intent = $headers->post(config('services.paymongo.base_url') . '/payment_intents', ['data' => ['attributes' => ['amount' => (int) round($pricing['amount'] * 100), 'currency' => 'PHP', 'payment_method_allowed' => ['card']]]]);
        if ($intent->failed()) {
            return response()->json(['success' => false, 'message' => 'Unable to start card payment.'], 502);
        }

        $method = $headers->post(config('services.paymongo.base_url') . '/payment_methods', ['data' => ['attributes' => ['type' => 'card', 'details' => ['card_number' => $cardNumber, 'exp_month' => (int) $request->expiry_month, 'exp_year' => (int) $request->expiry_year, 'cvc' => $request->cvv]]]]);
        if ($method->failed()) {
            return response()->json(['success' => false, 'message' => 'Card details were rejected by the sandbox.'], 400);
        }

        $attached = $headers->post(config('services.paymongo.base_url') . '/payment_intents/' . $intent->json('data.id') . '/attach', ['data' => ['attributes' => ['payment_method' => $method->json('data.id')]]]);
        $status = $attached->json('data.attributes.status');
        $payment = \App\Models\Payment::create([
            'reference' => $reference,
            'provider' => 'paymongo_test',
            'provider_id' => $intent->json('data.id'),
            'amount' => $pricing['amount'],
            'status' => $status === 'succeeded' ? 'paid' : 'failed',
            'paid_at' => $status === 'succeeded' ? now() : null,
            'failure_reason' => $status === 'succeeded' ? null : 'PayMongo sandbox declined the card.',
            'metadata' => ['sandbox' => true, 'payment_method_id' => $method->json('data.id')],
        ]);

        return response()->json([
            'success' => $status === 'succeeded',
            'transaction_id' => $intent->json('data.id'),
            'reference_number' => $payment->reference,
            'message' => $status === 'succeeded' ? 'Payment successful.' : 'Card declined by the sandbox.',
            'timestamp' => now()->toISOString(),
            'payment_method' => 'credit_card',
            'amount' => (float) $payment->amount,
        ], $status === 'succeeded' ? 200 : 400);
    }

    public function confirmPaymentFromMobile($reference)
    {
        try {
            $payment = Payment::where('reference', $reference)->firstOrFail();
            if ($payment->status === 'pending' && $payment->expires_at?->isPast()) {
                $payment->update(['status' => 'expired']);
            }
            if ($payment->status !== 'pending') {
                return response()->json([
                    'success' => $payment->status === 'paid',
                    'message' => $payment->status === 'paid' ? 'Payment was already confirmed.' : 'Payment cannot be confirmed in its current state.',
                    'reference_number' => $reference,
                    'status' => $payment->status,
                    'amount' => (float) $payment->amount,
                ], $payment->status === 'paid' ? 200 : 422);
            }

            DB::transaction(function () use ($payment) {
                $payment->update(['status' => 'paid', 'paid_at' => now()]);
                if ($payment->order) {
                    $payment->order->update(['payment_status' => 'paid']);
                }
            });

            Log::info('GCash QR payment confirmed via mobile scan', ['reference' => $reference, 'timestamp' => now()->toISOString()]);

            return response()->json([
                'success' => true,
                'message' => 'Payment confirmed successfully!',
                'reference_number' => $reference,
                'status' => 'paid',
                'amount' => (float) $payment->amount,
                'timestamp' => now()->toISOString(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error confirming payment', ['reference' => $reference, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Failed to confirm payment: ' . $e->getMessage(), 'reference_number' => $reference], 500);
        }
    }

    public function getPaymentStatus($reference)
    {
        try {
            $payment = Payment::where('reference', $reference)->firstOrFail();
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
            Log::error('Error getting payment status', ['reference' => $reference, 'error' => $e->getMessage()]);
            return response()->json(['confirmed' => false, 'status' => 'error', 'message' => 'Failed to get payment status'], 500);
        }
    }

    public function getOrderByReference($reference)
    {
        $payment = Payment::where('reference', $reference)->firstOrFail();
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
            ],
        ]);
    }

    public function getPaymentHistory(Request $request)
    {
        return response()->json(['success' => true, 'payments' => [], 'message' => 'Payment history retrieved successfully.']);
    }

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
        $payment = Payment::where('provider_id', $providerId)->first();

        if (!$payment && $providerId) {
            $payment = Payment::whereNotNull('metadata')->get()->first(fn ($candidate) => data_get($candidate->metadata, 'charge_id') === $providerId);
        }

        if (!$payment) {
            return response()->json(['status' => 'ignored']);
        }

        if ($eventType === 'source.chargeable') {
            $chargeId = data_get($payment->metadata, 'charge_id');
            if (!$chargeId) {
                $chargeResponse = Http::withBasicAuth(config('services.paymongo.secret_key'), '')
                    ->acceptJson()
                    ->post(config('services.paymongo.base_url') . '/payments', ['data' => ['attributes' => ['amount' => (int) round((float) $payment->amount * 100), 'currency' => 'PHP', 'description' => 'Oppa Dru GCash payment ' . $payment->reference, 'source' => ['id' => $payment->provider_id, 'type' => 'source']]]]);

                if ($chargeResponse->successful()) {
                    $payment->update(['metadata' => array_merge($payment->metadata ?? [], ['charge_id' => $chargeResponse->json('data.id')])]);
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