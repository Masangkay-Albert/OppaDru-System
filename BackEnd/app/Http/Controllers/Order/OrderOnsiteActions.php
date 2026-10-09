<?php

namespace App\Http\Controllers\Order;

use App\Models\Employee;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait OrderOnsiteActions
{
    public function storeOnsite(Request $request)
    {
        $this->decodeArrayInput($request, 'items');

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_name' => 'nullable|string',
            'items.*.product_price' => 'nullable|numeric|min:0',
            'items.*.quantity' => 'nullable|integer|min:1',
            'total' => 'required|numeric|min:0',
            'payment_method' => 'required|string',
            'dining_option' => 'nullable|string|in:dine_in,takeout',
            'customer_name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:500',
            'discount_type' => 'nullable|string',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'discount_amount' => 'nullable|numeric|min:0',
            'discount_id_number' => 'nullable|string|max:100',
            'cash_tendered' => 'nullable|numeric|min:0',
            'change_due' => 'nullable|numeric|min:0',
            'payment_reference' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $diningOption = strtolower((string) $request->input('dining_option', 'takeout'));
        $diningLabel = $diningOption === 'dine_in' ? 'Dine In' : 'Takeout';
        $customerName = trim((string) $request->input('customer_name', 'Walk-in Customer'));
        if ($customerName === '') {
            $customerName = 'Walk-in Customer';
        }

        $deliveryAddress = "Onsite - {$diningLabel} (Customer: {$customerName})";
        if ($request->filled('notes')) {
            $deliveryAddress .= ' | Notes: '.trim((string) $request->input('notes'));
        }

        $paymentMethod = (string) $request->input('payment_method', 'cash');
        $paymentReference = $request->input('payment_reference');
        if (empty($paymentReference) && $paymentMethod === 'cash') {
            $paymentReference = 'CASH-'.strtoupper(Str::random(8));
        }

        $discountType = $request->input('discount_type');
        $discountRate = $discountType ? (float) $request->input('discount_rate', 0.20) : null;
        $discountAmount = $discountType ? round((float) $request->input('discount_amount', 0)) : null;
        $discountIdNumber = $request->input('discount_id_number');

        $total = round((float) $request->input('total', 0));
        $vat = round((float) $request->input('vat', round($total * 0.12)));

        $cashierEmail = trim((string) ($request->input('cashier_email') ?: $request->input('email') ?: ''));
        if ($cashierEmail === '' || $cashierEmail === 'onsite@oppadru.ph') {
            $token = $request->bearerToken();
            if ($token) {
                $hashed = hash('sha256', $token);
                $employee = Employee::where('api_token', $hashed)->first();
                if ($employee && ! empty($employee->email)) {
                    $cashierEmail = $employee->email;
                }
            }
        }
        if ($cashierEmail === '' || $cashierEmail === 'onsite@oppadru.ph') {
            $cashierEmail = 'cashier@oppadru.ph';
        }

        $orderItems = $this->orderDataService->buildOrderItems($request->items);

        $order = Order::create([
            'email' => $cashierEmail,
            'user_id' => null,
            'total' => $total,
            'delivery_type' => 'onsite',
            'delivery_address' => $deliveryAddress,
            'delivery_lat' => null,
            'delivery_lng' => null,
            'delivery_coordinates' => null,
            'delivery_fee' => 0,
            'delivery_distance_km' => 0,
            'delivery_calculation_method' => 'onsite',
            'service_fee' => 0,
            'priority_fee' => 0,
            'vat' => $vat,
            'service_fee_rule' => null,
            'status' => 'pending',
            'payment_method' => $paymentMethod,
            'payment_status' => 'paid',
            'payment_reference' => $paymentReference,
            'phone' => $request->input('phone', '09000000000'),
            'items' => $orderItems,
            'discount_type' => $discountType ?: null,
            'discount_rate' => $discountRate,
            'discount_amount' => $discountAmount,
            'discount_status' => $discountType ? 'approved' : 'not_requested',
            'discount_proof_image' => $discountIdNumber
                ? "Verified ID: {$discountIdNumber}"
                : ($discountType ? 'In-Person Verified' : null),
            'discount_requested_at' => $discountType ? now() : null,
            'discount_reviewed_at' => $discountType ? now() : null,
        ]);

        $this->orderDataService->syncOrderItems($order, $orderItems);

        $order->refresh();

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Onsite order placed successfully!',
        ], 201);
    }
}
