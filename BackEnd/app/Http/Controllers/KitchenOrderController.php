<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class KitchenOrderController extends Controller
{
    // Fetch orders based on the requested tab/status
    public function index(Request $request)
    {
        $tab = $request->query('tab', 'pending');
        
        $query = Order::query()->with('user'); // Load the user relationship for the customer name

        if ($tab === 'pending') {
            $query->whereIn('status', ['pending']);
        } elseif ($tab === 'preparing') {
            $query->whereIn('status', ['preparing']);
        } else {
            // History tab: preserve historical order records while accepting the ready/prepared naming used elsewhere.
            $query->whereIn('status', ['prepared', 'ready', 'delivered', 'completed', 'cancelled']);
        }

        // Order by oldest first for pending (so first in, first out), or newest for history
        $direction = $tab === 'history' ? 'desc' : 'asc';
        $orders = $query->orderBy('created_at', $direction)->get();

        // Format the data to match what your React frontend expects
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
                'customerName' => $customerName,
                'status' => $order->status,
                'items' => $order->items, // Your model already casts this to an array
                'scheduleDisplay' => $order->schedule_display,
                'deliveryType' => $order->delivery_type,
                'created_at' => $order->created_at,
            ];
        });

        return response()->json($formattedOrders);
    }

    // Update the status of an order
  public function updateStatus(Request $request, string $id)
    {
        $request->validate([
            'status' => 'required|string|in:pending,preparing,prepared,ready,completed,cancelled'
        ]);

        $order = Order::findOrFail($id);
        $order->status = $request->status;
        $order->save();

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
    }
}