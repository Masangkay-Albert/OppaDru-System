<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Order;
use Illuminate\Http\Request;

class DriverOrderController extends Controller
{
    private function getAuthenticatedDriver(Request $request): ?Driver
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        return Driver::where('api_token', hash('sha256', $token))->first();
    }

    public function index(Request $request)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }
        if (!$driver->isActive || ($driver->franchise_id && (!$driver->franchise || !$driver->franchise->isOperationallyActive()))) {
            return response()->json(['message' => 'Driver account or branch is inactive.'], 403);
        }

        $tab = $request->query('tab', 'available');
        
        $query = Order::query()->with(['user', 'franchise:id,name,address,latitude,longitude'])
            ->where('franchise_id', $driver->franchise_id)
            ->where(function ($deliveryQuery) {
                $deliveryQuery->whereNull('delivery_type')->orWhere('delivery_type', '!=', 'onsite');
            });

        // Link the React tabs to the exact database statuses & driver ownership
        if ($tab === 'available') {
            // Reuse the existing order statuses and treat both prepared/ready as "ready for delivery".
            $query->whereIn('status', ['prepared', 'ready'])
                  ->whereNull('driver_id');
        } elseif ($tab === 'active') {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', ['on_the_way', 'arrived']);
        } else {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', ['delivered', 'cancelled']);
        }

        $direction = $tab === 'history' ? 'desc' : 'asc';
        $orders = $query->orderBy('created_at', $direction)->get();

        $formattedOrders = $orders->map(function ($order) {
            $customerName = 'Guest Customer';
            if ($order->user) {
                $name = trim(($order->user->first_name ?? '') . ' ' . ($order->user->last_name ?? ''));
                $customerName = $name ?: ($order->user->full_name ?? 'Customer');
            } elseif (!empty($order->delivery_address) && preg_match('/Customer:\s*([^)|]+)/i', (string) $order->delivery_address, $matches)) {
                $customerName = trim($matches[1]);
            }

            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'driver_id' => $order->driver_id,
                'customerName' => $customerName,
                'status' => $order->status,
                'items' => collect($order->items ?? [])->map(fn (array $item) => [
                    'name' => $item['name'] ?? $item['product_name'] ?? $item['title'] ?? 'Item',
                    'quantity' => (int) ($item['quantity'] ?? 0),
                    'selected_size' => $item['selected_size'] ?? null,
                    'selected_addons' => collect($item['selected_addons'] ?? [])->map(fn (array $addon) => [
                        'name' => $addon['name'] ?? $addon['addon_name'] ?? 'Add-on',
                        'quantity' => (int) ($addon['quantity'] ?? 1),
                    ])->values(),
                ])->values(),
                'scheduleDisplay' => $order->schedule_display,
                'deliveryType' => $order->delivery_type,
                'created_at' => $order->created_at,
                
                // Extra fields drivers need
                'deliveryAddress' => $order->delivery_address, 
                'phone' => $order->phone,
                'deliveryCoordinates' => ($order->delivery_lat !== null && $order->delivery_lng !== null)
                    ? ['lat' => (float) $order->delivery_lat, 'lng' => (float) $order->delivery_lng]
                    : null,
                'deliveryProofImageUrl' => $this->deliveryProofUrl($order->delivery_proof_image),
                'deliveryProofUploadedAt' => $order->delivery_proof_uploaded_at?->toISOString(),
                'branchName' => $order->franchise?->name,
                'branchAddress' => $order->franchise?->address,
                'branchCoordinates' => $order->franchise?->latitude !== null && $order->franchise?->longitude !== null
                    ? ['lat' => (float) $order->franchise->latitude, 'lng' => (float) $order->franchise->longitude]
                    : null,
            ];
        });

        return response()->json($formattedOrders);
    }

    private function deliveryProofUrl(?string $proofImage): ?string
    {
        if (!$proofImage) {
            return null;
        }

        if (str_starts_with($proofImage, 'data:image/') || str_starts_with($proofImage, 'http://') || str_starts_with($proofImage, 'https://')) {
            return $proofImage;
        }

        return rtrim(config('app.url'), '/').'/storage/'.ltrim($proofImage, '/');
    }

    public function updateStatus(Request $request, string $id)
    {
        $driver = $this->getAuthenticatedDriver($request);
        if (!$driver) {
            return response()->json(['message' => 'Unauthenticated driver.'], 401);
        }
        if (!$driver->isActive || ($driver->franchise_id && (!$driver->franchise || !$driver->franchise->isOperationallyActive()))) {
            return response()->json(['message' => 'Driver account or branch is inactive.'], 403);
        }

        $request->merge([
            'status' => strtolower(trim((string) $request->input('status', ''))),
        ]);

        $request->validate([
            'status' => 'required|string|in:on_the_way,arrived,delivered',
        ]);

        $targetStatus = $request->status;
        try {
            $order = \Illuminate\Support\Facades\DB::transaction(function () use ($driver, $id, $targetStatus) {
                $order = Order::where('franchise_id', $driver->franchise_id)
                    ->where(function ($deliveryQuery) {
                        $deliveryQuery->whereNull('delivery_type')->orWhere('delivery_type', '!=', 'onsite');
                    })
                    ->lockForUpdate()
                    ->findOrFail($id);

                if ($targetStatus === 'on_the_way') {
                    if (!in_array($order->status, ['prepared', 'ready'], true) || $order->driver_id) {
                        abort(response()->json(['message' => 'This delivery is no longer available to accept.'], 409));
                    }
                    $order->driver_id = $driver->id;
                } elseif ($order->driver_id !== $driver->id) {
                    abort(response()->json(['message' => 'This delivery is assigned to another driver.'], 403));
                }

                if ($targetStatus === 'arrived' && $order->status !== 'on_the_way') {
                    abort(response()->json(['message' => 'Start the delivery before marking arrival.'], 409));
                }
                if ($targetStatus === 'delivered' && !in_array($order->status, ['on_the_way', 'arrived'], true)) {
                    abort(response()->json(['message' => 'This delivery cannot be marked delivered from its current status.'], 409));
                }
                if ($targetStatus === 'delivered') {
                    $order->delivery_confirmed_at = $order->delivery_confirmed_at ?? now();
                }

                $order->status = $targetStatus;
                $order->save();

                return $order;
            });
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            return $exception->getResponse();
        }

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
    }
}