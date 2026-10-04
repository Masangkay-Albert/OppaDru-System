<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Employee;
use Illuminate\Http\Request;

class KitchenOrderController extends Controller
{
    // Fetch orders based on the requested tab/status
    public function index(Request $request)
    {
        $employee = $request->user();
        if (!$employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $tab = $request->query('tab', 'pending');
        
        $query = Order::query()->with('user')->where('franchise_id', $employee->franchise_id);

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
                $customerName = $name ?: ($order->user->full_name ?? 'Customer');
            } elseif (!empty($order->delivery_address) && preg_match('/Customer:\s*([^)|]+)/i', (string) $order->delivery_address, $matches)) {
                $customerName = trim($matches[1]);
            }

            return [
                'id' => $order->id,
                'customerName' => $customerName,
                'channel' => $order->delivery_type === 'onsite' || $order->delivery_calculation_method === 'onsite'
                    || str_starts_with(strtolower((string) $order->delivery_address), 'onsite')
                    ? 'onsite'
                    : 'online',
                'status' => $order->status,
                'items' => collect($order->items ?? [])->map(fn (array $item) => [
                    'name' => $item['name'] ?? $item['product_name'] ?? $item['title'] ?? 'Item',
                    'quantity' => (int) ($item['quantity'] ?? 0),
                    'selected_size' => $item['selected_size'] ?? null,
                    'selected_addons' => collect($item['selected_addons'] ?? [])->map(fn (array $addon) => [
                        'name' => $addon['name'] ?? $addon['addon_name'] ?? 'Add-on',
                        'quantity' => (int) ($addon['quantity'] ?? 1),
                    ])->values(),
                ])->values(),
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
        $employee = $request->user();
        if (!$employee instanceof Employee || strtolower((string) $employee->position) !== 'kitchen staff') {
            return response()->json(['message' => 'Kitchen staff access required.'], 403);
        }

        $request->validate([
            'status' => 'required|string|in:pending,preparing,prepared,ready,completed,cancelled'
        ]);

        $order = Order::where('franchise_id', $employee->franchise_id)->findOrFail($id);
        $isOnsiteOrder = $order->delivery_type === 'onsite'
            || $order->delivery_calculation_method === 'onsite'
            || str_starts_with(strtolower((string) $order->delivery_address), 'onsite');
        $order->status = $request->status === 'prepared' && $isOnsiteOrder
            ? 'delivered'
            : $request->status;
        $order->save();

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
    }
}