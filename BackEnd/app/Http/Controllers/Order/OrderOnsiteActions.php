<?php

namespace App\Http\Controllers\Order;

use App\Models\Employee;
use App\Models\EmployeeAuthSession;
use App\Models\Franchise;
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

        $promoCode = $request->input('promo_code');
        $promoDiscount = (float) $request->input('promo_discount', $request->input('voucher_discount', 0));
        $promoId = $request->input('promo_id');
        if (empty($promoId) && !empty($promoCode)) {
            $promo = \App\Models\Promo::where('code', strtoupper(trim($promoCode)))->first();
            if ($promo) {
                $promoId = $promo->id;
                $promo->increment('times_used');
            }
        }

        $total = round((float) $request->input('total', 0));
        $vat = round((float) $request->input('vat', round($total * 0.12)));

        $cashierEmail = trim((string) ($request->input('cashier_email') ?: $request->input('email') ?: ''));
        $token = $request->bearerToken();
        $employee = $token
            ? EmployeeAuthSession::employeeForToken($token)
                ?? Employee::where('api_token', hash('sha256', $token))->first()
            : null;
        if ($cashierEmail === '' || $cashierEmail === 'onsite@oppadru.ph') {
            if ($employee && ! empty($employee->email)) {
                $cashierEmail = $employee->email;
            }
        }
        if ($cashierEmail === '' || $cashierEmail === 'onsite@oppadru.ph') {
            $cashierEmail = 'cashier@oppadru.ph';
        }

        $branch = $employee?->franchise ?? Franchise::where('is_main', true)->first();
        $orderItems = $this->orderDataService->buildOrderItems($request->items);

        $order = Order::create([
            'franchise_id' => $branch?->id,
            'franchise_account_id' => $branch?->franchise_account_id,
            'branch_id' => $branch?->id,
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
            'promo_id' => $promoId,
            'promo_code' => $promoCode,
            'promo_discount' => $promoDiscount > 0 ? $promoDiscount : null,
            'discount_status' => $discountType ? 'approved' : 'not_requested',
            'discount_proof_image' => $discountIdNumber
                ? "Verified ID: {$discountIdNumber}"
                : ($discountType ? 'In-Person Verified' : null),
            'discount_requested_at' => $discountType ? now() : null,
            'discount_reviewed_at' => $discountType ? now() : null,
        ]);

        if ($paymentMethod === 'gcash' && !empty($paymentReference)) {
            $payment = \App\Models\Payment::where('reference', $paymentReference)->first();
            if ($payment) {
                $payment->update([
                    'order_id' => $order->id,
                    'status' => 'paid',
                    'paid_at' => $payment->paid_at ?? now(),
                ]);
            }
        }

        $this->orderDataService->syncOrderItems($order, $orderItems);

        $order->refresh();
        $order->setAttribute('branch_name', $branch?->name);

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Onsite order placed successfully!',
        ], 201);
    }
}
