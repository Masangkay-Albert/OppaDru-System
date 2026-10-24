<?php

namespace App\Http\Controllers\Order;

use App\Models\Order;
use App\Models\Franchise;
use App\Models\User;
use Illuminate\Http\Request;

trait OrderQueryActions
{
    public function index()
    {
        $mainBranchIds = Franchise::query()->where('is_main', true)->pluck('id');
        $orders = Order::query()
            ->where(function ($query) use ($mainBranchIds) {
                $query->where(function ($unassigned) {
                    $unassigned->whereNull('branch_id')->whereNull('franchise_id');
                });

                if ($mainBranchIds->isNotEmpty()) {
                    $query->orWhereIn('branch_id', $mainBranchIds)
                        ->orWhere(function ($legacyMainOrders) use ($mainBranchIds) {
                            $legacyMainOrders->whereNull('branch_id')
                                ->whereIn('franchise_id', $mainBranchIds);
                        });
                }
            })
            ->select([
            'id', 'order_number', 'email', 'user_id', 'branch_id', 'franchise_id', 'franchise_account_id', 'total', 'status',
            'payment_method', 'payment_status', 'delivery_address', 'delivery_lat', 'delivery_lng', 'delivery_coordinates', 'phone', 'items', 'created_at',
            'delivery_proof_image', 'delivery_proof_uploaded_at', 'delivery_confirmed_at',
            'discount_proof_image',
            'delivery_fee', 'delivery_distance_km', 'delivery_calculation_method', 'delivery_type', 'service_fee', 'priority_fee', 'service_fee_rule',
            'scheduled_at', 'scheduled_date', 'scheduled_time', 'schedule_display', 'schedule_window',
        ])
            ->selectRaw("CASE WHEN delivery_proof_image_data IS NOT NULL AND delivery_proof_image_data <> '' THEN 1 ELSE 0 END AS has_delivery_proof_image_data")
            ->selectRaw("CASE WHEN discount_proof_image_data IS NOT NULL AND discount_proof_image_data <> '' THEN 1 ELSE 0 END AS has_discount_proof_image_data")
            ->with([
            'user:id,full_name',
            'branch:id,name,address,latitude,longitude',
            'franchise:id,name,address,latitude,longitude',
            'orderItems',
        ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function show(Request $request, $id)
    {
        $order = $this->customerOrders($request)
            ->with(['user', 'branch', 'franchise', 'orderItems'])
            ->findOrFail($id);

        return response()->json($this->orderDataService->formatOrder($order));
    }

    public function getUserOrders(Request $request)
    {
        $orders = $this->customerOrders($request)
            ->with([
                'orderItems',
                'branch:id,name,address,latitude,longitude',
                'franchise:id,name,address,latitude,longitude',
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function getUserOrder(Request $request, string $id)
    {
        $order = $this->customerOrders($request)
            ->with([
                'orderItems',
                'branch:id,name,address,latitude,longitude',
                'franchise:id,name,address,latitude,longitude',
            ])
            ->find($id);

        if (! $order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        return response()->json($this->orderDataService->formatOrder($order));
    }

    private function customerOrders(Request $request)
    {
        $user = $request->user();

        return Order::query()->withoutProofImagePayload()->where(function ($query) use ($user) {
            $query->where('user_id', $user->id)
                ->orWhere(function ($legacyOrders) use ($user) {
                    $legacyOrders->whereNull('user_id')
                        ->whereRaw('LOWER(email) = ?', [strtolower((string) $user->email)]);
                });
        });
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
