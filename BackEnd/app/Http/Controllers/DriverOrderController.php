<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class DriverOrderController extends Controller
{
    public function index(Request $request)
    {
        $tab = $request->query('tab', 'available');
        
        $query = Order::query()->with('user');

        // This is where we link the React tabs to the exact database statuses!
        if ($tab === 'available') {
            // Show orders the kitchen is DONE preparing, ready for a driver
            $query->whereIn('status', ['prepared']);
        } elseif ($tab === 'active') {
            // Show orders currently being delivered
            $query->whereIn('status', ['out_for_delivery', 'delivering']); 
        } else {
            // History tab
            $query->whereIn('status', ['completed', 'delivered', 'cancelled']);
        }

        $direction = $tab === 'history' ? 'desc' : 'asc';
        $orders = $query->orderBy('created_at', $direction)->get();

        $formattedOrders = $orders->map(function ($order) {
            return [
                'id' => $order->id,
                'customerName' => $order->user 
                    ? $order->user->first_name . ' ' . $order->user->last_name 
                    : ($order->email ?? 'Guest Customer'),
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
        $request->validate([
            // Ensure drivers can only update to driver-specific statuses
            'status' => 'required|string|in:out_for_delivery,completed,delivered'
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