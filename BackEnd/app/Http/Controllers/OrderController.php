<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Order\OrderDataService;
use App\Services\PricingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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
            'payment_reference' => 'required_if:payment_method,gcash,credit_card|nullable|string|exists:payments,reference',
        ]);

        $validator->after(function ($validator) use ($request) {
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
        ]);

        $this->orderDataService->syncOrderItems($order, $orderItems);

        $payment?->update(['order_id' => $order->id]);
        $order->refresh();

        return response()->json([
            'order' => $order,
            'message' => 'Order placed successfully!'
        ], 201);
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
            'status' => 'required|string|in:pending,preparing,ready,scheduled,on_the_way,out_for_delivery,delivered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $order = Order::findOrFail($id);

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

        if (in_array($request->status, ['out_for_delivery', 'delivered'], true) && strtolower((string) ($order->delivery_type ?? 'standard')) === 'scheduled') {
            $scheduledAt = $order->scheduled_at ? Carbon::parse($order->scheduled_at, 'Asia/Manila') : null;
            if (!$scheduledAt || $scheduledAt->isFuture()) {
                return response()->json([
                    'message' => 'Scheduled orders cannot be marked as out for delivery or delivered before their scheduled time.',
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