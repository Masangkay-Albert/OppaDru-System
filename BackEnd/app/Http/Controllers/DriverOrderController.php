<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Order;
use App\Support\DriverOrderScope;
use App\Support\OrderStatus;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        $branchId = DriverOrderScope::branchId($driver);
        
        $query = Order::query()->withoutProofImagePayload()->with([
            'user',
            'branch:id,name,address,latitude,longitude',
            'franchise:id,name,address,latitude,longitude',
            'originalOrder:id,order_number',
        ]);
        DriverOrderScope::applyBranch($query, $branchId);
        DriverOrderScope::applyDeliveryEligibility($query);

        if ($tab === 'available') {
            $query->where('status', OrderStatus::PREPARED)
                  ->whereNull('driver_id');
        } elseif ($tab === 'active') {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', [OrderStatus::ON_THE_WAY, OrderStatus::ARRIVED]);
        } else {
            $query->where('driver_id', $driver->id)
                  ->whereIn('status', [OrderStatus::DELIVERED, OrderStatus::CANCELLED]);
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
                'is_replacement' => (bool) $order->replacement_of_order_id,
                'original_order_number' => $order->originalOrder?->order_number,
                'payment_method' => $order->replacement_of_order_id ? 'replacement' : $order->payment_method,
                'payment_message' => $order->replacement_of_order_id ? 'Replacement, no payment to collect' : null,
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
                'deliveryInstructions' => $order->delivery_instructions,
                'phone' => $order->phone,
                'deliveryCoordinates' => ($order->delivery_lat !== null && $order->delivery_lng !== null)
                    ? ['lat' => (float) $order->delivery_lat, 'lng' => (float) $order->delivery_lng]
                    : null,
                'deliveryProofImageUrl' => $this->deliveryProofUrl($order->delivery_proof_image),
                'deliveryProofUploadedAt' => $order->delivery_proof_uploaded_at?->toISOString(),
                'branchName' => $order->branch?->name ?? $order->franchise?->name,
                'branch_name' => $order->branch?->name ?? $order->franchise?->name,
                'branchAddress' => ($order->branch ?? $order->franchise)?->address,
                'branchCoordinates' => ($order->branch ?? $order->franchise)?->latitude !== null
                    && ($order->branch ?? $order->franchise)?->longitude !== null
                    ? [
                        'lat' => (float) ($order->branch ?? $order->franchise)->latitude,
                        'lng' => (float) ($order->branch ?? $order->franchise)->longitude,
                    ]
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
            'status' => ['required', 'string', Rule::in(OrderStatus::DRIVER_ALLOWED_TRANSITIONS)],
        ]);

        $targetStatus = $request->status;
        $branchId = DriverOrderScope::branchId($driver);
        try {
            $order = \Illuminate\Support\Facades\DB::transaction(function () use ($driver, $id, $targetStatus, $branchId) {
                $order = Order::with(['branch:id,name', 'franchise:id,name'])
                    ->lockForUpdate();
                DriverOrderScope::applyBranch($order, $branchId);
                DriverOrderScope::applyDeliveryEligibility($order);
                $order = $order->findOrFail($id);

                if ($targetStatus === OrderStatus::ON_THE_WAY) {
                    if ($order->status !== OrderStatus::PREPARED || $order->driver_id) {
                        abort(response()->json(['message' => 'This delivery is no longer available to accept.'], 409));
                    }
                    $order->driver_id = $driver->id;
                } elseif ($order->driver_id !== $driver->id) {
                    abort(response()->json(['message' => 'This delivery is assigned to another driver.'], 403));
                }

                if ($targetStatus === OrderStatus::ARRIVED && $order->status !== OrderStatus::ON_THE_WAY) {
                    abort(response()->json(['message' => 'Start the delivery before marking arrival.'], 409));
                }
                if ($targetStatus === OrderStatus::DELIVERED && !in_array($order->status, [OrderStatus::ON_THE_WAY, OrderStatus::ARRIVED], true)) {
                    abort(response()->json(['message' => 'This delivery cannot be marked delivered from its current status.'], 409));
                }
                if ($targetStatus === OrderStatus::DELIVERED) {
                    $order->delivery_confirmed_at = $order->delivery_confirmed_at ?? now();
                }

                $order->status = $targetStatus;
                $order->save();
                $order->setAttribute('branch_name', $order->branch?->name ?? $order->franchise?->name);

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