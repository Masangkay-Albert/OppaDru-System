<?php

namespace App\Http\Controllers\Payment;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

trait PaymentWebhookActions
{
    public function webhook(Request $request)
    {
        $signature = $request->header('Paymongo-Signature', '');
        $secret = config('services.paymongo.webhook_secret');
        if (! $secret || ! $this->validPayMongoSignature($request->getContent(), $signature, $secret)) {
            return response()->json(['message' => 'Invalid webhook signature.'], 401);
        }

        $event = $request->json()->all();
        $eventType = data_get($event, 'data.attributes.type');
        $eventData = data_get($event, 'data.attributes.data', []);
        $providerId = data_get($eventData, 'id');
        $attributes = data_get($eventData, 'attributes', []);
        $payment = Payment::where('provider_id', $providerId)->first();

        if (! $payment && $providerId) {
            $payment = Payment::whereNotNull('metadata')->get()->first(fn ($candidate) => data_get($candidate->metadata, 'charge_id') === $providerId);
        }

        if (! $payment) {
            return response()->json(['status' => 'ignored']);
        }

        if ($eventType === 'source.chargeable') {
            $chargeId = data_get($payment->metadata, 'charge_id');
            if (! $chargeId) {
                $chargeResponse = Http::withBasicAuth(config('services.paymongo.secret_key'), '')
                    ->acceptJson()
                    ->post(config('services.paymongo.base_url').'/payments', ['data' => ['attributes' => ['amount' => (int) round((float) $payment->amount * 100), 'currency' => 'PHP', 'description' => 'Oppa Dru GCash payment '.$payment->reference, 'source' => ['id' => $payment->provider_id, 'type' => 'source']]]]);

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

            if (! $newStatus) {
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
        if (! $timestamp || ! $signature || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        return hash_equals($signature, hash_hmac('sha256', $timestamp.'.'.$payload, $secret));
    }
}
