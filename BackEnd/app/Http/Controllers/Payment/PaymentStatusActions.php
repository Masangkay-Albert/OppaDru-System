<?php

namespace App\Http\Controllers\Payment;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

trait PaymentStatusActions
{
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

            return response()->json(['success' => false, 'message' => 'Failed to confirm payment: '.$e->getMessage(), 'reference_number' => $reference], 500);
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
}
