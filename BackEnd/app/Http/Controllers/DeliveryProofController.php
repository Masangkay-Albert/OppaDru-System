<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Driver;
use App\Models\Order;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DeliveryProofController extends Controller
{
    use AdminAuthTrait;

    public function store(Request $request, string $id)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }

        $request->validate([
            'proof_image' => 'required|file|image|mimes:jpeg,jpg,png,webp|max:5120',
        ]);

        $order = Order::findOrFail($id);
        if ($order->driver_id !== $driver->id || !in_array($order->status, ['arrived', 'delivered'], true)) {
            return response()->json(['message' => 'You must mark the delivery as delivered before uploading proof.'], 403);
        }

        $previousImage = $order->delivery_proof_image;
        $path = $request->file('proof_image')->store('delivery-proofs', 'public');
        $order->delivery_proof_image = $path;
        $order->delivery_proof_uploaded_at = now();
        $order->delivery_confirmed_at = null;
        $order->save();

        if ($previousImage) {
            Storage::disk('public')->delete($previousImage);
        }

        $baseUrl = (function_exists('request') && request()?->hasHeader('host'))
            ? rtrim(request()->root(), '/')
            : rtrim(config('app.url'), '/');

        return response()->json([
            'message' => 'Delivery proof submitted for admin review.',
            'delivery_proof_image_url' => $baseUrl . '/storage/' . ltrim($path, '/'),
            'delivery_proof_uploaded_at' => $order->delivery_proof_uploaded_at?->toISOString(),
        ]);
    }

    public function confirm(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $order = Order::findOrFail($id);
        if (!$order->delivery_proof_image) {
            return response()->json(['message' => 'This order has no pending delivery proof to confirm.'], 422);
        }

        if (!in_array($order->status, ['arrived', 'on_the_way', 'delivered'], true)) {
            return response()->json(['message' => 'This delivery is not awaiting admin confirmation.'], 422);
        }

        $admin = Admin::where('api_token', hash('sha256', (string) $request->bearerToken()))->firstOrFail();
        $order->status = 'delivered';
        $order->delivery_confirmed_at = now();
        $order->delivery_proof_uploaded_at = $order->delivery_proof_uploaded_at ?? now();
        $order->save();

        return response()->json([
            'message' => 'Delivery proof confirmed.',
            'order' => $order,
            'confirmed_by' => $admin->id,
        ]);
    }

    private function getAuthenticatedDriver(Request $request): ?Driver
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return Driver::where('api_token', hash('sha256', $token))->first();
    }
}