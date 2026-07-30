<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    public function index()
    {
        return response()->json(Order::all());
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

        $order = Order::create([
            'email' => $request->email,
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
        return response()->json(Order::findOrFail($id));
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
            'order' => $order,
            'message' => 'Order status updated!'
        ]);
    }

    public function getUserOrders(Request $request)
    {
        $email = $request->user()->email;
        return response()->json(
            Order::where('email', $email)
                ->orderBy('created_at', 'desc')
                ->get()
        );
    }
}
