<?php

namespace App\Http\Controllers\Payment;

use App\Models\Addon;
use App\Models\Franchise;
use App\Models\Payment;
use App\Services\FranchiseInventoryService;
use App\Services\PromoRedemptionException;
use App\Services\PromoRedemptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

trait PaymentCheckoutActions
{
    private function validateAmount(Request $request): ?array
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'promo_code' => 'nullable|string|max:50',
            'franchise_id' => 'nullable|string|exists:franchises,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|integer|exists:addons,id',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled,onsite',
            'fulfillment_type' => 'nullable|string|in:pickup,delivery,onsite',
            'delivery_coordinates' => 'nullable|array|required_unless:fulfillment_type,pickup,onsite',
            'delivery_coordinates.lat' => 'required_unless:fulfillment_type,pickup,onsite|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_unless:fulfillment_type,pickup,onsite|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return ['success' => false, 'message' => $validator->errors()->first(), 'status' => 422];
        }

        try {
            $isPickup = in_array($request->input('fulfillment_type'), ['pickup', 'onsite'], true) || $request->input('delivery_type') === 'onsite';
            $branchResolution = $this->branchRoutingService->resolve(
                $request->input('delivery_coordinates'),
                $isPickup ? $request->input('franchise_id') : null,
                $isPickup,
            );
        } catch (\InvalidArgumentException $exception) {
            return ['success' => false, 'message' => $exception->getMessage(), 'status' => 422];
        }
        $franchiseId = (string) $branchResolution['branch']->id;
        $unavailable = $this->branchRoutingService->validateCatalog($franchiseId, $request->input('items', []));
        if ($unavailable !== []) return ['success' => false, 'message' => 'One or more items are unavailable at the assigned branch.', 'status' => 422];

        try {
            $promoDiscount = 0.0;
            $promoCode = trim((string) $request->input('promo_code', ''));
            if ($promoCode !== '') {
                $userId = $request->user()?->getAuthIdentifier();
                $retryAfter = app(PromoRedemptionService::class)->rateLimitRetryAfter($request, $userId);
                if ($retryAfter !== null) {
                    return [
                        'success' => false,
                        'message' => 'Too many attempts. Please wait a minute and try again.',
                        'error_code' => 'PROMO_RATE_LIMITED',
                        'status' => 429,
                    ];
                }
                $promoDiscount = app(PromoRedemptionService::class)->evaluate(
                    $promoCode,
                    $request->input('items', []),
                    $userId,
                )['discount'];
            }
            $pricing = $this->pricingService->calculate(
                $request->items,
                $request->input('delivery_type', 'standard'),
                $promoDiscount,
                (float) $request->input('discount_rate', 0),
                $request->input('delivery_coordinates'),
                ['lat' => (float) $branchResolution['branch']->latitude, 'lng' => (float) $branchResolution['branch']->longitude],
            );
            if (round((float) $request->amount) !== $pricing['total']) {
                return ['success' => false, 'message' => 'The checkout total has changed. Please review your order.', 'status' => 422];
            }

            return ['success' => true, 'amount' => $pricing['total'], 'franchise_id' => $franchiseId, 'branch' => $branchResolution['branch'], 'distance_km' => $branchResolution['distance_km']];
        } catch (PromoRedemptionException $exception) {
            if ($promoCode !== '') {
                app(PromoRedemptionService::class)->recordInvalidAttempt(
                    $request,
                    $request->user()?->getAuthIdentifier(),
                    strtoupper((string) preg_replace('/\s+/', '', $promoCode)),
                    $exception->errorCode,
                );
            }
            return [
                'success' => false,
                'message' => $exception->getMessage(),
                'error_code' => $exception->errorCode,
                'status' => 422,
            ];
        } catch (\InvalidArgumentException $exception) {
            return ['success' => false, 'message' => $exception->getMessage(), 'status' => 422];
        }
    }

    public function createGCashPayment(Request $request)
    {
        $validated = $this->validateAmount($request);
        if (($validated['success'] ?? false) === false) {
            return response()->json([
                'success' => false,
                'message' => $validated['message'],
                'error_code' => $validated['error_code'] ?? null,
            ], $validated['status'] ?? 422);
        }

        $amount = $validated['amount'];
        $secretKey = config('services.paymongo.secret_key');
        if (! $secretKey) {
            $payment = Payment::create([
                'reference' => $this->paymentHelper->generateReferenceNumber(),
                'provider' => 'sandbox',
                'amount' => $amount,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(5),
                'metadata' => [
                    'sandbox' => true,
                    'checkout_url' => null,
                    'franchise_id' => $validated['franchise_id'],
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

        $reference = $this->paymentHelper->generateReferenceNumber();
        $response = Http::withBasicAuth($secretKey, '')
            ->acceptJson()
            ->post(config('services.paymongo.base_url').'/sources', [
                'data' => ['attributes' => [
                    'amount' => (int) round($amount * 100),
                    'currency' => 'PHP',
                    'type' => 'gcash',
                    'redirect' => ['success' => rtrim(config('app.frontend_url'), '/').'/payment/confirm/'.$reference, 'failed' => rtrim(config('app.frontend_url'), '/').'/payment/confirm/'.$reference],
                ]],
            ]);

        if ($response->failed()) {
            Log::error('Unable to create PayMongo GCash source', ['status' => $response->status(), 'body' => $response->json()]);

            return response()->json(['success' => false, 'message' => 'Unable to start GCash payment.'], 502);
        }

        $source = $response->json('data');
        $attributes = $source['attributes'] ?? [];
        $payment = Payment::create([
            'reference' => $reference,
            'provider_id' => $source['id'],
            'amount' => $amount,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
            'metadata' => [
                'source_status' => $attributes['status'] ?? 'pending',
                'checkout_url' => $attributes['redirect']['checkout_url'] ?? null,
                'franchise_id' => $validated['franchise_id'],
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

    public function requestGCashOTP(Request $request)
    {
        $validator = Validator::make($request->all(), ['mobile_number' => 'required|string']);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $mobile = preg_replace('/\s/', '', $request->mobile_number);
        if (! $this->paymentHelper->validateMobileNumber($mobile)) {
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
            $this->paymentHelper->buildPaymentPayload($success, $success ? 'Payment successful!' : 'Payment failed. Please try again.', (float) $request->amount, 'gcash', $success ? $this->paymentHelper->generateReferenceNumber() : null, $success ? 'GCASH-'.time() : null),
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
        if (! $this->paymentHelper->validateCardNumber($cardNumber)) {
            return response()->json(['success' => false, 'message' => 'Invalid card number.'], 400);
        }
        if ($this->paymentHelper->isCardExpired($request->expiry_month, $request->expiry_year)) {
            return response()->json(['success' => false, 'message' => 'Card has expired.'], 400);
        }

        $pricing = $this->validateAmount($request);
        if (($pricing['success'] ?? false) === false) {
            return response()->json([
                'success' => false,
                'message' => $pricing['message'],
                'error_code' => $pricing['error_code'] ?? null,
            ], $pricing['status'] ?? 422);
        }

        $secretKey = config('services.paymongo.secret_key');
        if (! $secretKey || ! str_starts_with($secretKey, 'sk_test_')) {
            return response()->json(['success' => false, 'message' => 'Card sandbox payments are not configured.'], 503);
        }

        $reference = $this->paymentHelper->generateReferenceNumber();
        $headers = Http::withBasicAuth($secretKey, '')->acceptJson();
        $intent = $headers->post(config('services.paymongo.base_url').'/payment_intents', ['data' => ['attributes' => ['amount' => (int) round($pricing['amount'] * 100), 'currency' => 'PHP', 'payment_method_allowed' => ['card']]]]);
        if ($intent->failed()) {
            return response()->json(['success' => false, 'message' => 'Unable to start card payment.'], 502);
        }

        $method = $headers->post(config('services.paymongo.base_url').'/payment_methods', ['data' => ['attributes' => ['type' => 'card', 'details' => ['card_number' => $cardNumber, 'exp_month' => (int) $request->expiry_month, 'exp_year' => (int) $request->expiry_year, 'cvc' => $request->cvv]]]]);
        if ($method->failed()) {
            return response()->json(['success' => false, 'message' => 'Card details were rejected by the sandbox.'], 400);
        }

        $attached = $headers->post(config('services.paymongo.base_url').'/payment_intents/'.$intent->json('data.id').'/attach', ['data' => ['attributes' => ['payment_method' => $method->json('data.id')]]]);
        $status = $attached->json('data.attributes.status');
        $payment = Payment::create([
            'reference' => $reference,
            'provider' => 'paymongo_test',
            'provider_id' => $intent->json('data.id'),
            'amount' => $pricing['amount'],
            'status' => $status === 'succeeded' ? 'paid' : 'failed',
            'paid_at' => $status === 'succeeded' ? now() : null,
            'failure_reason' => $status === 'succeeded' ? null : 'PayMongo sandbox declined the card.',
            'metadata' => [
                'sandbox' => true,
                'payment_method_id' => $method->json('data.id'),
                'franchise_id' => $pricing['franchise_id'],
            ],
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
}
