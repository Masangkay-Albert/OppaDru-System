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
            // Show orders the kitchen is DONE preparing, ready for a driver and not yet accepted
            $query->whereIn('status', ['prepared'])
                  ->whereNull('driver_id');
        } elseif ($tab === 'active') {
            // Show orders currently being delivered by this driver
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', ['on_the_way']); 
        } else {
            // History tab: show only orders that THIS driver accepted and delivered/cancelled
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

        $request->validate([
            // Drivers can only accept order (on_the_way) or complete it (delivered)
            'status' => 'required|string|in:on_the_way,delivered'
        ]);

        $order = Order::findOrFail($id);

        $targetStatus = $request->status;

        if ($targetStatus === 'on_the_way') {
            // Check if order has already been accepted by another driver
            if ($order->driver_id && $order->driver_id !== $driver->id) {
                return response()->json([
                    'message' => 'This order has already been accepted by another driver.'
                ], 409);
            }
            $order->driver_id = $driver->id;
        } elseif ($targetStatus === 'delivered') {
            // Ensure only the driver who accepted the order can mark it delivered
            if ($order->driver_id && $order->driver_id !== $driver->id) {
                return response()->json([
                    'message' => 'Unauthorized. You did not accept this order.'
                ], 403);
            }
            if (!$order->driver_id) {
                $order->driver_id = $driver->id;
            }
        }

        $order->status = $targetStatus;
        $order->save();

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
    }
}