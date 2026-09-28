<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Order;
use Illuminate\Http\Request;

class DriverOrderController extends Controller
{
    private function getAuthenticatedDriver(Request $request): ?Driver
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return Driver::where('api_token', hash('sha256', $token))->first();
    }

    public function index(Request $request)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }

        $tab = $request->query('tab', 'available');
        
        $query = Order::query()->with('user');

        // Link the React tabs to the exact database statuses & driver ownership
        if ($tab === 'available') {
            // Reuse the existing order statuses and treat both prepared/ready as "ready for delivery".
            $query->whereIn('status', ['prepared', 'ready'])
                  ->whereNull('driver_id');
        } elseif ($tab === 'active') {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', ['on_the_way', 'arrived']);
        } else {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', ['delivered', 'cancelled']);
        }

        $direction = $tab === 'history' ? 'desc' : 'asc';
        $orders = $query->orderBy('created_at', $direction)->get();

        $formattedOrders = $orders->map(function ($order) {
            $customerName = 'Guest Customer';
            if ($order->user) {
                $name = trim(($order->user->first_name ?? '') . ' ' . ($order->user->last_name ?? ''));
                $customerName = $name ?: ($order->user->full_name ?? $order->email ?? 'Customer');
            } elseif (!empty($order->delivery_address) && preg_match('/Customer:\s*([^)|]+)/i', (string) $order->delivery_address, $matches)) {
                $customerName = trim($matches[1]);
            } elseif (!empty($order->email) && !str_starts_with($order->email, 'onsite')) {
                $customerName = $order->email;
            }

            return [
                'id' => $order->id,
                'driver_id' => $order->driver_id,
                'customerName' => $customerName,
                'status' => $order->status,
                'items' => $order->items,
                'scheduleDisplay' => $order->schedule_display,
                'deliveryType' => $order->delivery_type,
                'created_at' => $order->created_at,
                
                // Extra fields drivers need
                'deliveryAddress' => $order->delivery_address, 
                'phone' => $order->phone,
                'total' => $order->total,
                'paymentMethod' => $order->payment_method,
                'deliveryCoordinates' => ($order->delivery_lat !== null && $order->delivery_lng !== null)
                    ? ['lat' => (float) $order->delivery_lat, 'lng' => (float) $order->delivery_lng]
                    : null,
                'deliveryProofImageUrl' => $order->delivery_proof_image
                    ? rtrim(config('app.url'), '/') . '/storage/' . ltrim($order->delivery_proof_image, '/')
                    : null,
                'deliveryProofUploadedAt' => $order->delivery_proof_uploaded_at?->toISOString(),
            ];
        });

        return response()->json($formattedOrders);
    }

    public function updateStatus(Request $request, string $id)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }

        $request->merge([
            'status' => strtolower(trim((string) $request->input('status', ''))),
        ]);

        $request->validate([
            'status' => 'required|string|in:on_the_way,arrived,delivered',
        ]);

        $order = Order::findOrFail($id);

        $targetStatus = $request->status;

        if ($targetStatus === 'on_the_way') {
            if ($order->driver_id && $order->driver_id !== $driver->id) {
                return response()->json([
                    'message' => 'This order has already been accepted by another driver.'
                ], 409);
            }
            $order->driver_id = $driver->id;
        }

        // Allow proof submission after the driver confirms arrival or delivered.
        if ($targetStatus === 'arrived' || $targetStatus === 'delivered') {
            $order->driver_id = $driver->id;
        }

        if ($targetStatus === 'delivered') {
            $order->delivery_confirmed_at = $order->delivery_confirmed_at ?? now();
        }

        $order->status = $targetStatus;
        $order->save();

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
    }
}