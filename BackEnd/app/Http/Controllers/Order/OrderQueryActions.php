<?php

namespace App\Http\Controllers\Order;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;

trait OrderQueryActions
{
    public function index()
    {
        $orders = Order::select([
            'id', 'order_number', 'email', 'user_id', 'branch_id', 'franchise_id', 'franchise_account_id', 'total', 'status',
            'payment_method', 'payment_status', 'delivery_address', 'delivery_lat', 'delivery_lng', 'delivery_coordinates', 'phone', 'items', 'created_at',
            'delivery_proof_image', 'delivery_proof_uploaded_at', 'delivery_confirmed_at',
            'delivery_proof_image_data', 'discount_proof_image', 'discount_proof_image_data',
            'delivery_fee', 'delivery_distance_km', 'delivery_calculation_method', 'delivery_type', 'service_fee', 'priority_fee', 'service_fee_rule',
            'scheduled_at', 'scheduled_date', 'scheduled_time', 'schedule_display', 'schedule_window',
        ])->with(['user:id,full_name', 'branch:id,name,address,latitude,longitude', 'orderItems'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function show($id)
    {
        $order = Order::with(['user', 'branch', 'orderItems'])->findOrFail($id);

        return response()->json($this->orderDataService->formatOrder($order));
    }

    public function getUserOrders(Request $request)
    {
        $email = $request->user()->email;
        $orders = Order::with(['orderItems', 'branch:id,name,address,latitude,longitude'])->where('email', $email)->orderBy('created_at', 'desc')->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function getAllCustomers()
    {
        $customerStats = Order::query()
            ->select('user_id')
            ->selectRaw('COUNT(*) as order_count')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');
        $customerSpent = Order::countedAsRevenue()
            ->select('user_id')
            ->selectRaw('COALESCE(SUM(total), 0) as total_spent')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $users = User::select('id', 'full_name', 'email', 'phone', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($user) use ($customerStats, $customerSpent) {
                $stats = $customerStats->get($user->id);
                $spent = $customerSpent->get($user->id);

                return [
                    'id' => $user->id,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'date_registered' => $user->created_at,
                    'order_count' => (int) ($stats->order_count ?? 0),
                    'total_spent' => (float) ($spent->total_spent ?? 0),
                ];
            });

        return response()->json(['data' => $users]);
    }
}
