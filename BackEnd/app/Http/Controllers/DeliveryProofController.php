<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Order;
use App\Support\DatabaseImage;
use Illuminate\Http\Request;

class DeliveryProofController extends Controller
{
    public function store(Request $request, string $id)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }
        if (!$driver->isActive || ($driver->franchise_id && (!$driver->franchise || !$driver->franchise->isOperationallyActive()))) {
            return response()->json(['message' => 'Driver account or branch is inactive.'], 403);
        }

        $request->validate([
            'proof_image' => 'required|file|image|mimes:jpeg,jpg,png,webp|max:5120',
        ]);

        $order = Order::where('franchise_id', $driver->franchise_id)
            ->where('driver_id', $driver->id)
            ->where(function ($query) {
                $query->whereNull('delivery_type')->orWhere('delivery_type', '!=', 'onsite');
            })
            ->findOrFail($id);
        if (!in_array($order->status, ['on_the_way', 'arrived', 'delivered'], true)) {
            return response()->json(['message' => 'You can only upload proof for an active delivery assigned to you.'], 403);
        }

        $order->delivery_proof_image_data = DatabaseImage::fromUploadedFile($request->file('proof_image'));
        $order->delivery_proof_image = null;
        $order->delivery_proof_uploaded_at = now();
        $order->save();

        return response()->json([
            'message' => 'Delivery proof uploaded successfully.',
            'delivery_proof_image_url' => $order->delivery_proof_image,
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