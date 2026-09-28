<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DeliveryProofController extends Controller
{
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
        if ($order->driver_id !== $driver->id || !in_array($order->status, ['on_the_way', 'arrived', 'delivered'], true)) {
            return response()->json(['message' => 'You can only upload proof for an active delivery assigned to you.'], 403);
        }

        $previousImage = $order->delivery_proof_image;
        $path = $request->file('proof_image')->store('delivery-proofs', 'public');
        $order->delivery_proof_image = $path;
        $order->delivery_proof_uploaded_at = now();
        $order->save();

        if ($previousImage) {
            Storage::disk('public')->delete($previousImage);
        }

        $baseUrl = (function_exists('request') && request()?->hasHeader('host'))
            ? rtrim(request()->root(), '/')
            : rtrim(config('app.url'), '/');

        return response()->json([
            'message' => 'Delivery proof uploaded successfully.',
            'delivery_proof_image_url' => $baseUrl . '/storage/' . ltrim($path, '/'),
            'delivery_proof_uploaded_at' => $order->delivery_proof_uploaded_at?->toISOString(),
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