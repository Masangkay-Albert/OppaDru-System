<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Services\PricingService;
use App\Models\Product;

class OrderController extends Controller
{
    public function index()
    {
        $orders = Order::select([
            'id', 'order_number', 'email', 'user_id', 'total', 'status',
            'payment_method', 'delivery_address', 'phone', 'items', 'created_at',
        ])->with('user:id,full_name')->orderBy('created_at', 'desc')->get();
        
        $formattedOrders = $orders->map(function ($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'email' => $order->email,
                'customer_name' => $order->user ? $order->user->full_name : 'Guest',
                'user_id' => $order->user_id,
                'total' => $order->total,
                'status' => $order->status,
                'payment_method' => $order->payment_method,
                'delivery_address' => $order->delivery_address,
                'phone' => $order->phone,
                'items' => $order->items,
                'created_at' => $order->created_at ? $this->convertToPhilippineTime($order->created_at) : null,
            ];
        });

        return response()->json($formattedOrders);
    }

    private function convertToPhilippineTime($timestamp)
    {
        if (!$timestamp) return null;
        $date = new \DateTime($timestamp);
        $date->setTimezone(new \DateTimeZone('Asia/Manila'));
        return $date->format('Y-m-d\TH:i:sP');
    }

    public function show($id)
    {
        $order = Order::with('user')->findOrFail($id);
        
        $formattedOrder = [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'email' => $order->email,
            'customer_name' => $order->user ? $order->user->full_name : 'Guest',
            'user_id' => $order->user_id,
            'total' => $order->total,
            'status' => $order->status,
            'payment_method' => $order->payment_method,
            'delivery_address' => $order->delivery_address,
            'phone' => $order->phone,
            'items' => $order->items,
            'created_at' => $order->created_at ? $this->convertToPhilippineTime($order->created_at) : null,
        ];

        return response()->json($formattedOrder);
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
            'total' => 'required|numeric|min:0',
            'delivery_address' => 'required|string',
            'payment_method' => 'required|string|in:cash_on_delivery,gcash,credit_card',
            'delivery_type' => 'nullable|string|in:standard,priority',
            'voucher_discount' => 'nullable|numeric|min:0',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'phone' => 'required|string',
            'payment_reference' => 'required_if:payment_method,gcash,credit_card|nullable|string|exists:payments,reference',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $pricing = app(PricingService::class)->calculate(
                $request->items,
                $request->input('delivery_type', 'standard'),
                (float) $request->input('voucher_discount', 0),
                (float) $request->input('discount_rate', 0)
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

        $orderItems = [];

        foreach ($request->items as $item) {
            $product = Product::find($item['product_id']);
            $orderItems[] = [
                'product_id' => $item['product_id'],
                'product_name' => $product->name,
                'product_price' => $product->price,
                'quantity' => $item['quantity'],
                'selected_addons' => $item['selected_addons'] ?? [],
                'special_instructions' => $item['special_instructions'] ?? null,
            ];
        }

        $user = User::where('email', $request->email)->first();
        $userId = $user ? $user->id : null;

        $order = Order::create([
            'email' => $request->email,
            'user_id' => $userId,
            'total' => $total,
            'status' => 'pending',
            'payment_method' => $request->payment_method,
            'delivery_address' => $request->delivery_address,
            'phone' => $request->phone,
            'items' => $orderItems,
            'payment_reference' => $payment?->reference,
            'payment_status' => $payment ? 'paid' : 'pending',
        ]);

        $payment?->update(['order_id' => $order->id]);

        return response()->json([
            'order' => $order,
            'message' => 'Order placed successfully!'
        ], 201);
    }

    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,preparing,ready,out_for_delivery,delivered,cancelled',
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
            'message' => 'Order status updated!'
        ]);
    }

    public function getUserOrders(Request $request)
    {
        $email = $request->user()->email;
        $orders = Order::where('email', $email)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'email' => $order->email,
                    'total' => $order->total,
                    'status' => $order->status,
                    'payment_method' => $order->payment_method,
                    'delivery_address' => $order->delivery_address,
                    'phone' => $order->phone,
                    'items' => $order->items,
                    'created_at' => $order->created_at ? $this->convertToPhilippineTime($order->created_at) : null,
                ];
            });

        return response()->json($orders);
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