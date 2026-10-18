<?php

namespace App\Http\Controllers;

use App\Services\BranchRoutingService;
use App\Services\PricingService;
use Illuminate\Http\Request;

class BranchRoutingController extends Controller
{
    public function __construct(private readonly BranchRoutingService $routing, private readonly PricingService $pricing) {}

    public function resolve(Request $request)
    {
        $validated = $request->validate([
            'coordinates' => 'nullable|array|required_unless:fulfillment_type,pickup',
            'coordinates.lat' => 'required_unless:fulfillment_type,pickup|numeric|between:-90,90',
            'coordinates.lng' => 'required_unless:fulfillment_type,pickup|numeric|between:-180,180',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|exists:addons,id',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'voucher_discount' => 'nullable|numeric|min:0',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'fulfillment_type' => 'nullable|string|in:pickup,delivery',
            'franchise_id' => 'nullable|string',
        ]);

        try {
            $result = $this->routing->resolve(
                $validated['coordinates'] ?? null,
                $validated['fulfillment_type'] === 'pickup' ? ($validated['franchise_id'] ?? null) : null,
                ($validated['fulfillment_type'] ?? 'delivery') === 'pickup',
            );
            $unavailable = $this->routing->validateCatalog((string) $result['branch']->id, $validated['items']);
            $pricing = $this->pricing->calculate(
                $validated['items'],
                $validated['delivery_type'] ?? 'standard',
                (float) ($validated['voucher_discount'] ?? 0),
                (float) ($validated['discount_rate'] ?? 0),
                $validated['coordinates'] ?? null,
                ['lat' => (float) $result['branch']->latitude, 'lng' => (float) $result['branch']->longitude],
            );

            return response()->json(['data' => [
                'branch' => $result['branch']->only(['id', 'name', 'address', 'latitude', 'longitude', 'status']),
                'distance_km' => $result['distance_km'],
                'notice' => $result['notice'],
                'unavailable_items' => $unavailable,
                'pricing' => $pricing,
            ]]);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
