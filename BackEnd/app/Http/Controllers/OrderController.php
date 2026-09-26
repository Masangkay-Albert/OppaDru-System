<?php

namespace App\Http\Controllers;

use App\Models\DiscountVerificationRequest;
use App\Models\Employee;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Order\OrderDataService;
use App\Services\PricingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function __construct(private readonly OrderDataService $orderDataService)
    {
    }

    public function index()
    {
        $orders = Order::select([
            'id', 'order_number', 'email', 'user_id', 'total', 'status',
            'payment_method', 'delivery_address', 'delivery_lat', 'delivery_lng', 'delivery_coordinates', 'phone', 'items', 'created_at',
            'delivery_proof_image', 'delivery_proof_uploaded_at', 'delivery_confirmed_at',
            'delivery_fee', 'delivery_distance_km', 'delivery_calculation_method', 'delivery_type', 'service_fee', 'priority_fee', 'service_fee_rule',
            'scheduled_at', 'scheduled_date', 'scheduled_time', 'schedule_display', 'schedule_window',
        ])->with(['user:id,full_name', 'orderItems'])
        ->orderBy('created_at', 'desc')
        ->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function show($id)
    {
        $order = Order::with(['user', 'orderItems'])->findOrFail($id);

        return response()->json($this->orderDataService->formatOrder($order));
    }

    private function resolveScheduledDelivery(Request $request): array
    {
        $deliveryType = strtolower((string) $request->input('delivery_type', 'standard'));

        if ($deliveryType !== 'scheduled') {
            return [
                'scheduled_at' => null,
                'scheduled_date' => null,
                'scheduled_time' => null,
                'schedule_display' => null,
                'schedule_window' => null,
            ];
        }

        $scheduledAtInput = $request->input('scheduled_at');
        $scheduledDate = $request->input('scheduled_date');
        $scheduledTime = $request->input('scheduled_time');
        $scheduleWindow = $request->input('schedule_window');

        $candidates = [];
        if ($scheduledAtInput) {
            $candidates[] = $scheduledAtInput;
        }

        if ($scheduledDate || $scheduledTime || $scheduleWindow) {
            $datePart = $scheduledDate ?: Carbon::now('Asia/Manila')->format('Y-m-d');
            $timePart = $scheduledTime ?: $scheduleWindow ?: '12:00 PM';
            $candidates[] = $datePart . ' ' . $timePart;
        }

        $parsed = null;
        foreach ($candidates as $candidate) {
            try {
                $parsed = Carbon::parse($candidate, 'Asia/Manila');
                break;
            } catch (\Throwable) {
                continue;
            }
        }

        if (!$parsed) {
            throw new \InvalidArgumentException('Scheduled delivery requires a valid future date and time.');
        }

        if (!$parsed->isFuture()) {
            throw new \InvalidArgumentException('Scheduled delivery must be set for a future date and time.');
        }

        $scheduleWindowValue = $scheduleWindow ?: $scheduledTime ?: $parsed->setTimezone('Asia/Manila')->format('g:i A');
        $scheduleDisplayValue = $request->input('schedule_display') ?: $parsed->setTimezone('Asia/Manila')->format('M j, Y • g:i A');

        return [
            'scheduled_at' => $parsed->setTimezone('Asia/Manila')->toDateTimeString(),
            'scheduled_date' => $parsed->setTimezone('Asia/Manila')->format('Y-m-d'),
            'scheduled_time' => $scheduledTime ?: $scheduleWindowValue,
            'schedule_display' => $scheduleDisplayValue,
            'schedule_window' => $scheduleWindowValue,
        ];
    }

    public function store(Request $request)
    {
        if (!$request->hasFile('proof_image') && $request->hasFile('discount_proof_image')) {
            $request->files->set('proof_image', $request->file('discount_proof_image'));
        }

        if (is_string($request->input('items')) && !is_array($request->input('items'))) {
            $decodedItems = json_decode((string) $request->input('items'), true);
            if (is_array($decodedItems)) {
                $request->merge(['items' => $decodedItems]);
            }
        }

        if (is_string($request->input('delivery_coordinates')) && !is_array($request->input('delivery_coordinates'))) {
            $decodedCoordinates = json_decode((string) $request->input('delivery_coordinates'), true);
            if (is_array($decodedCoordinates)) {
                $request->merge(['delivery_coordinates' => $decodedCoordinates]);
            }
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_name' => 'required|string',
            'items.*.product_price' => 'required|numeric',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.special_instructions' => 'nullable|string',
            'total' => 'nullable|numeric|min:0',
            'delivery_address' => 'required|string',
            'payment_method' => 'required|string|in:cash_on_delivery,gcash,credit_card',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'scheduled_at' => 'nullable|date',
            'scheduled_date' => 'nullable|date',
            'scheduled_time' => 'nullable|string',
            'schedule_display' => 'nullable|string',
            'schedule_window' => 'nullable|string',
            'voucher_discount' => 'nullable|numeric|min:0',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'delivery_coordinates' => 'nullable|array',
            'delivery_coordinates.lat' => 'required_with:delivery_coordinates|numeric|between:-90,90',
            'delivery_coordinates.lng' => 'required_with:delivery_coordinates|numeric|between:-180,180',
            'phone' => 'required|string',
            'discount_type' => 'nullable|string|in:PWD,Senior Citizen',
            'proof_image' => 'nullable|file|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'discount_proof_image' => 'nullable|file|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'payment_reference' => 'required_if:payment_method,gcash,credit_card|nullable|string|exists:payments,reference',
        ]);

        $validator->after(function ($validator) use ($request) {
            if ($request->filled('discount_type') && !$request->hasFile('proof_image') && !$request->hasFile('discount_proof_image')) {
                $validator->errors()->add('proof_image', 'The proof image field is required when discount type is present.');
            }

            if (strtolower((string) $request->input('delivery_type', 'standard')) !== 'scheduled') {
                return;
            }

            $scheduledAtInput = $request->input('scheduled_at');
            $scheduledDate = $request->input('scheduled_date');
            $scheduledTime = $request->input('scheduled_time');
            $scheduleWindow = $request->input('schedule_window');

            if (!$scheduledAtInput && (!$scheduledDate || (!$scheduledTime && !$scheduleWindow))) {
                $validator->errors()->add('scheduled_at', 'Scheduled delivery requires a valid future date and time.');
                return;
            }

            try {
                $scheduledData = $this->resolveScheduledDelivery($request);
            } catch (\InvalidArgumentException $exception) {
                $validator->errors()->add('scheduled_at', $exception->getMessage());
                return;
            }

            if ($scheduledData['scheduled_at'] === null) {
                $validator->errors()->add('scheduled_at', 'Scheduled delivery requires a valid future date and time.');
            }
        });

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $scheduledData = $this->resolveScheduledDelivery($request);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['errors' => ['scheduled_at' => [$exception->getMessage()]]], 422);
        }

        try {
            $pricing = app(PricingService::class)->calculate(
                $request->items,
                $request->input('delivery_type', 'standard'),
                (float) $request->input('voucher_discount', 0),
                (float) $request->input('discount_rate', 0),
                $request->input('delivery_coordinates')
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $total = $pricing['total'];
        $payment = null;
        if (in_array($request->payment_method, ['gcash', 'credit_card'], true)) {
            $payment = Payment::where('reference', $request->payment_reference)->first();
            if (!$payment || $payment->status !== 'paid' || round((float) $payment->amount, 2) !== $total) {
                return response()->json(['message' => 'Payment is not confirmed for this order.'], 422);
            }

            $existingOrder = Order::where('payment_reference', $payment->reference)->first();
            if ($existingOrder) {
                return response()->json([
                    'order' => $existingOrder,
                    'message' => 'Order was already placed.'
                ]);
            }
        }

        $orderItems = $this->orderDataService->buildOrderItems($request->items);

        $user = User::where('email', $request->email)->first();
        $userId = $user ? $user->id : null;

        $discountType = trim((string) $request->input('discount_type', ''));
        $discountRate = 0.20;
        $discountAmount = 0;
        $discountProofUrl = null;

        if ($discountType !== '') {
            $discountAmount = round((float) $total * $discountRate, 2);
            if ($request->hasFile('proof_image') || $request->hasFile('discount_proof_image')) {
                $file = $request->file('proof_image') ?? $request->file('discount_proof_image');
                $filename = time() . '-' . uniqid('', true) . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('discount-proof', $filename, 'public');
                $discountProofUrl = rtrim(config('app.url', 'https://oppadru-system-1.onrender.com'), '/') . '/storage/' . ltrim($path, '/');
            }
        }

        $order = Order::create([
            'email' => $request->email,
            'user_id' => $userId,
            'total' => $total,
            'delivery_type' => $request->input('delivery_type', 'standard'),
            'delivery_address' => $request->delivery_address,
            'delivery_lat' => $request->input('delivery_coordinates.lat'),
            'delivery_lng' => $request->input('delivery_coordinates.lng'),
            'delivery_coordinates' => $request->input('delivery_coordinates'),
            'delivery_fee' => $pricing['deliveryFee'],
            'delivery_distance_km' => $pricing['deliveryDistanceKm'],
            'delivery_calculation_method' => $pricing['deliveryCalculationMethod'],
            'service_fee' => $pricing['serviceFee'],
            'priority_fee' => $pricing['priorityFee'],
            'vat' => $pricing['vat'],
            'service_fee_rule' => $pricing['serviceFeeRule'],
            'status' => 'pending',
            'payment_method' => $request->payment_method,
            'phone' => $request->phone,
            'items' => $orderItems,
            'scheduled_at' => $scheduledData['scheduled_at'],
            'scheduled_date' => $scheduledData['scheduled_date'],
            'scheduled_time' => $scheduledData['scheduled_time'],
            'schedule_display' => $scheduledData['schedule_display'],
            'schedule_window' => $scheduledData['schedule_window'],
            'payment_reference' => $payment?->reference,
            'payment_status' => $payment ? 'paid' : 'pending',
            'discount_type' => $discountType !== '' ? $discountType : null,
            'discount_rate' => $discountType !== '' ? $discountRate : null,
            'discount_amount' => $discountType !== '' ? 0 : null,
            'discount_status' => $discountType !== '' ? 'pending' : 'not_requested',
            'discount_proof_image' => $discountType !== '' ? $discountProofUrl : null,
            'discount_requested_at' => $discountType !== '' ? now() : null,
            'discount_rejection_reason' => null,
            'discount_reviewed_at' => null,
        ]);

        $this->orderDataService->syncOrderItems($order, $orderItems);

        $discountRequest = null;
        if ($discountType !== '') {
            $discountRequest = DiscountVerificationRequest::create([
                'order_id' => $order->id,
                'discount_type' => $discountType,
                'discount_rate' => $discountRate,
                'discount_amount' => $discountAmount,
                'proof_image_url' => $discountProofUrl,
                'status' => 'pending',
                'submitted_at' => now(),
                'order_total_at_submission' => $total,
            ]);
        }

        $payment?->update(['order_id' => $order->id]);
        $order->refresh();

        return response()->json([
            'order' => $order,
            'discount_request' => $discountRequest,
            'message' => 'Order placed successfully!'
        ], 201);
    }

    public function storeOnsite(Request $request)
    {
        if (is_string($request->input('items')) && !is_array($request->input('items'))) {
            $decodedItems = json_decode((string) $request->input('items'), true);
            if (is_array($decodedItems)) {
                $request->merge(['items' => $decodedItems]);
            }
        }

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
            $deliveryAddress .= " | Notes: " . trim((string) $request->input('notes'));
        }

        $paymentMethod = (string) $request->input('payment_method', 'cash');
        $paymentReference = $request->input('payment_reference');
        if (empty($paymentReference) && $paymentMethod === 'cash') {
            $paymentReference = 'CASH-' . strtoupper(Str::random(8));
        }

        $discountType = $request->input('discount_type');
        $discountRate = $discountType ? (float) $request->input('discount_rate', 0.20) : null;
        $discountAmount = $discountType ? (float) $request->input('discount_amount', 0) : null;
        $discountIdNumber = $request->input('discount_id_number');

        $total = (float) $request->input('total', 0);
        $vat = (float) $request->input('vat', round($total * 0.12, 2));

        $cashierEmail = trim((string) ($request->input('cashier_email') ?: $request->input('email') ?: ''));
        if ($cashierEmail === '' || $cashierEmail === 'onsite@oppadru.ph') {
            $token = $request->bearerToken();
            if ($token) {
                $hashed = hash('sha256', $token);
                $employee = Employee::where('api_token', $hashed)->first();
                if ($employee && !empty($employee->email)) {
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
            'discount_proof_image' => $discountIdNumber ? "Verified ID: {$discountIdNumber}" : ($discountType ? 'In-Person Verified' : null),
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

    public function updateStatusOnsite(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,preparing,prepared,ready,delivered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $order = Order::findOrFail($id);
        $order->status = $request->status;
        $order->save();

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Order status updated successfully!',
        ]);
    }

    public function update(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        if ($order->status !== 'pending') {
            return response()->json(['message' => 'Only pending orders can be edited or cancelled.'], 422);
        }

        $createdAt = $order->created_at;
        $now = now();
        $elapsedSeconds = $createdAt ? abs($createdAt->diffInSeconds($now, false)) : null;

        if (!$createdAt || $createdAt->isFuture() || $elapsedSeconds > 20) {
            return response()->json([
                'message' => 'Order can no longer be cancelled or edited.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|string',
            'items.*.product_name' => 'required|string',
            'items.*.product_price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_addons' => 'nullable|array',
            'delivery_address' => 'nullable|string',
            'phone' => 'nullable|string',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $pricing = app(PricingService::class)->calculate(
            $request->items,
            $request->input('delivery_type', $order->delivery_type ?? 'standard'),
            0,
            0,
            $request->input('delivery_coordinates') ?? null
        );

        $order->fill([
            'items' => $request->items,
            'delivery_address' => $request->input('delivery_address', $order->delivery_address),
            'phone' => $request->input('phone', $order->phone),
            'delivery_type' => $request->input('delivery_type', $order->delivery_type ?? 'standard'),
            'total' => $pricing['total'],
            'delivery_fee' => $pricing['deliveryFee'],
            'delivery_distance_km' => $pricing['deliveryDistanceKm'],
            'delivery_calculation_method' => $pricing['deliveryCalculationMethod'],
            'service_fee' => $pricing['serviceFee'],
            'priority_fee' => $pricing['priorityFee'],
            'vat' => $pricing['vat'],
            'service_fee_rule' => $pricing['serviceFeeRule'],
        ]);
        $order->save();

        $this->orderDataService->syncOrderItems($order, $request->items);

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Order updated successfully.'
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $order = Order::findOrFail($id);

        if ($order->email !== $request->user()->email) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($request->status === 'cancelled') {
            $createdAt = $order->created_at;
            $now = now();
            $elapsedSeconds = $createdAt ? abs($createdAt->diffInSeconds($now, false)) : null;

            if (!$createdAt || $createdAt->isFuture() || $elapsedSeconds > 20 || $order->status !== 'pending') {
                return response()->json([
                    'message' => 'Order cancellation is only allowed within 20 seconds of creation.',
                ], 422);
            }
        }

        $order->status = $request->status;
        $order->save();

        return response()->json([
            'success' => true,
            'order' => $order,
            'message' => 'Order status updated!'
        ]);
    }

    public function getUserOrders(Request $request)
    {
        $email = $request->user()->email;
        $orders = Order::with('orderItems')->where('email', $email)->orderBy('created_at', 'desc')->get();

        return response()->json($this->orderDataService->formatOrders($orders));
    }

    public function getAllCustomers()
    {
        $customerStats = Order::query()
            ->select('user_id')
            ->selectRaw('COUNT(*) as order_count')
            ->selectRaw('COALESCE(SUM(total), 0) as total_spent')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $users = User::select('id', 'full_name', 'email', 'phone', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($user) use ($customerStats) {
            $stats = $customerStats->get($user->id);

            return [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'date_registered' => $user->created_at,
                'order_count' => (int) ($stats->order_count ?? 0),
                'total_spent' => (float) ($stats->total_spent ?? 0),
            ];
        });

        return response()->json(['data' => $users]);
    }
}