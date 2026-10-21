<?php

namespace App\Http\Controllers\Franchise;

use App\Models\Employee;
use App\Models\FranchiseUser;
use App\Models\Order;
use App\Services\FranchiseInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

trait FranchisePosReadActions
{
    public function employeePosProducts(Request $request)
    {
        $user = $request->user();
        if (
            ! $user instanceof Employee
            || ! $user->franchise_id
            || strtolower((string) $user->position) !== 'cashier'
        ) {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        return response()->json([
            'data' => app(FranchiseInventoryService::class)->catalog((string) $user->franchise_id, true),
        ]);
    }

    public function employeePosOrders(Request $request)
    {
        $user = $request->user();
        if (
            ! $user instanceof Employee
            || ! $user->franchise_id
            || strtolower((string) $user->position) !== 'cashier'
        ) {
            return response()->json(['message' => 'Branch cashier access required.'], 403);
        }

        $orders = Order::where('branch_id', $user->franchise_id)
                ->where('cashier_employee_id', $user->id)
                ->where('delivery_type', 'onsite')
                ->with('branch:id,name')
                ->orderByDesc('created_at')
                ->limit(100)
                ->get([
                    'id',
                    'order_number',
                    'branch_id',
                    'total',
                    'payment_method',
                    'payment_status',
                    'payment_reference',
                    'status',
                    'created_at',
                ]);
        $orders->each(fn (Order $order) => $order->setAttribute('branch_name', $order->branch?->name));

        return response()->json(['data' => $orders]);
    }

    public function franchisePosOrders(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise manager access required.'], 403);
        }

        $validator = Validator::make($request->query(), [
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'payment_method' => 'nullable|string|in:cash,gcash,credit_card',
            'cashier_id' => 'nullable|string|exists:employees,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'The POS activity filters are invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $query = Order::where('branch_id', $user->franchise_id)
            ->where('delivery_type', 'onsite')
            ->with([
                'franchise.franchiseAccount:id,name',
                'branch:id,name',
                'cashier:id,fullName,email',
                'franchiseOperator:id,full_name,email',
                'payment:id,order_id,reference,status,paid_at',
            ]);
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }
        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->query('payment_method'));
        }
        if ($request->filled('cashier_id')) {
            $query->where('cashier_employee_id', $request->query('cashier_id'));
        }

        $salesQuery = (clone $query)->countedAsRevenue();
        $salesCount = (clone $salesQuery)->count();
        $salesTotal = (float) (clone $salesQuery)->sum('total');
        $averageSale = (float) (clone $salesQuery)->avg('total');
        $orders = $query
            ->orderByDesc('created_at')
            ->paginate((int) $request->query('per_page', 50));
        $rows = $orders->getCollection();

        return response()->json([
            'data' => $rows->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'franchise_id' => $order->franchise_id,
                'branch_name' => $order->branch?->name ?? $order->franchise?->name,
                'franchise' => $order->franchise?->franchiseAccount ? [
                    'id' => $order->franchise->franchiseAccount->id,
                    'name' => $order->franchise->franchiseAccount->name,
                ] : null,
                'location' => [
                    'id' => $order->franchise_id,
                    'name' => $order->franchise?->name,
                ],
                'location_name' => $order->franchise?->name,
                'cashier_employee_id' => $order->cashier_employee_id,
                'franchise_user_id' => $order->franchise_user_id,
                'operator_email' => $order->email,
                'cashier' => $order->cashier ? [
                    'id' => $order->cashier->id,
                    'name' => $order->cashier->fullName,
                    'email' => $order->cashier->email,
                ] : null,
                'franchise_operator' => $order->franchiseOperator ? [
                    'id' => $order->franchiseOperator->id,
                    'name' => $order->franchiseOperator->full_name,
                    'email' => $order->franchiseOperator->email,
                ] : null,
                'total' => (float) $order->total,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'payment_reference' => $order->payment_reference,
                'gateway_payment' => $order->payment ? [
                    'reference' => $order->payment->reference,
                    'status' => $order->payment->status,
                    'paid_at' => $order->payment->paid_at,
                ] : null,
                'status' => $order->status,
                'created_at' => $order->created_at,
            ]),
            'summary' => [
                'transaction_count' => $orders->total(),
                'sales_count' => $salesCount,
                'total_sales' => $salesTotal,
                'average_transaction_value' => $averageSale,
            ],
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
            ],
        ]);
    }
}
