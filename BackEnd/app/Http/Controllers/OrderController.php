<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    public function index()
    {
        $orders = Order::with('user')->orderBy('id', 'desc')->get();
        
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
            ];
        });

        return response()->json($formattedOrders);
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
            'phone' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $orderItems = [];

        foreach ($request->items as $item) {
            $orderItems[] = [
                'product_id' => $item['product_id'],
                'product_name' => $item['product_name'],
                'product_price' => $item['product_price'],
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
            'total' => $request->total,
            'status' => 'pending',
            'payment_method' => $request->payment_method,
            'delivery_address' => $request->delivery_address,
            'phone' => $request->phone,
            'items' => $orderItems,
        ]);

        return response()->json([
            'order' => $order,
            'message' => 'Order placed successfully!'
        ], 201);
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
        ];

        return response()->json($formattedOrder);
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
        return response()->json(
            Order::where('email', $email)
                ->orderBy('id', 'desc')
                ->get()
        );
    }

    public function getAllCustomers()
    {
        $users = User::orderBy('id', 'desc')->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'date_registered' => $user->created_at,
                'order_count' => Order::where('user_id', $user->id)->count(),
                'total_spent' => Order::where('user_id', $user->id)->sum('total'),
            ];
        });

        return response()->json(['data' => $users]);
    }
}