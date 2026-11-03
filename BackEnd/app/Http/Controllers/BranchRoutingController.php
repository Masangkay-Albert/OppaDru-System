<?php

namespace App\Http\Controllers;

use App\Services\BranchRoutingService;
use App\Services\GeocodingService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BranchRoutingController extends Controller
{
    public function __construct(
        private readonly BranchRoutingService $routing,
        private readonly PricingService $pricing,
        private readonly GeocodingService $geocoding,
    ) {}

    public function resolve(Request $request)
    {
        $validated = $request->validate([
            'address' => 'required_unless:fulfillment_type,pickup|string|max:2000',
            'coordinates' => 'nullable|array',
            'coordinates.lat' => 'required_with:coordinates|numeric|between:-90,90',
            'coordinates.lng' => 'required_with:coordinates|numeric|between:-180,180',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_size' => 'nullable|string|in:Small,Medium,Large',
            'items.*.selected_addons' => 'nullable|array',
            'items.*.selected_addons.*.id' => 'required|exists:addons,id',
            'delivery_type' => 'nullable|string|in:standard,priority,scheduled',
            'voucher_discount' => 'nullable|numeric|min:0',
            'discount_rate' => 'nullable|numeric|min:0|max:1',
            'fulfillment_type' => 'nullable|string|in:pickup,delivery',
            'franchise_id' => 'nullable|string',
        ]);

        $coordinates = $validated['coordinates'] ?? null;
        $hasTopLevelLatitude = array_key_exists('latitude', $validated) && $validated['latitude'] !== null;
        $hasTopLevelLongitude = array_key_exists('longitude', $validated) && $validated['longitude'] !== null;
        if ($hasTopLevelLatitude !== $hasTopLevelLongitude) {
            return response()->json([
                'code' => 'INVALID_COORDINATES',
                'message' => 'Latitude and longitude must be provided together.',
            ], 422);
        }
        if (! $coordinates && $hasTopLevelLatitude) {
            $coordinates = ['lat' => $validated['latitude'], 'lng' => $validated['longitude']];
        }

        $isPickup = ($validated['fulfillment_type'] ?? 'delivery') === 'pickup';
        if (! $isPickup && ! $coordinates) {
            $geocoded = $this->geocoding->geocodeAddress($validated['address']);
            if (! $geocoded) {
                return response()->json([
                    'code' => 'ADDRESS_NOT_FOUND',
                    'message' => "We couldn't locate this address. Please edit it or pick a pin on the map.",
                ], 422);
            }
            if ($geocoded['isBroad'] ?? false) {
                $broadCoordinates = ['lat' => (float) $geocoded['lat'], 'lng' => (float) $geocoded['lng']];
                $diagnostics = $this->routing->diagnostics($broadCoordinates);
                Log::info('Broad address geocode requires explicit map confirmation.', [
                    'customer_coordinates' => $broadCoordinates,
                    'matched_query' => $geocoded['matchedQuery'] ?? null,
                    'branches' => $diagnostics,
                ]);
                $response = [
                    'code' => 'ADDRESS_TOO_BROAD',
                    'message' => 'This address only identifies a city, town, province, or region. Pin your exact delivery location on the map.',
                ];
                if (config('app.debug')) {
                    $response['branch_diagnostics'] = $diagnostics;
                }

                return response()->json($response, 422);
            }
            $coordinates = ['lat' => $geocoded['lat'], 'lng' => $geocoded['lng']];
        }

        try {
            $result = $this->routing->resolve(
                $coordinates,
                $isPickup ? ($validated['franchise_id'] ?? null) : null,
                $isPickup,
            );
            $unavailable = $this->routing->validateCatalog((string) $result['branch']->id, $validated['items']);
            $pricing = $this->pricing->calculate(
                $validated['items'],
                $validated['delivery_type'] ?? 'standard',
                (float) ($validated['voucher_discount'] ?? 0),
                (float) ($validated['discount_rate'] ?? 0),
                $coordinates,
                ['lat' => (float) $result['branch']->latitude, 'lng' => (float) $result['branch']->longitude],
                (string) $result['branch']->id,
            );
            $branch = $result['branch'];

            return response()->json(['data' => [
                'franchise_account_id' => $branch->franchise_account_id,
                'name' => $branch->name,
                'branch' => $branch->only([
                    'id', 'name', 'address', 'latitude', 'longitude', 'status', 'franchise_account_id',
                ]),
                'customer_coordinates' => $coordinates,
                'distance_km' => $result['distance_km'],
                'notice' => $result['notice'],
                'unavailable_items' => $unavailable,
                'pricing' => $pricing,
                ...(config('app.debug') ? [
                    'branch_diagnostics' => $result['branch_diagnostics'] ?? $this->routing->diagnostics($coordinates),
                ] : []),
            ]]);
        } catch (\InvalidArgumentException $exception) {
            $message = $exception->getMessage();
            $code = match ($message) {
                BranchRoutingService::NO_BRANCH_COORDINATES_MESSAGE => 'BRANCHES_NOT_CONFIGURED',
                BranchRoutingService::NO_ELIGIBLE_DELIVERY_BRANCH_MESSAGE => 'NO_ELIGIBLE_BRANCH',
                default => str_starts_with($message, 'Nearest branch is ')
                    ? 'NO_BRANCH_IN_RANGE'
                    : 'BRANCH_RESOLUTION_FAILED',
            };
            $status = 422;
            $response = [
                'code' => $code,
                'message' => $message,
            ];
            if (config('app.debug') && isset($coordinates['lat'], $coordinates['lng'])) {
                $response['branch_diagnostics'] = $this->routing->diagnostics($coordinates);
            }

            return response()->json($response, $status);
        } catch (\Throwable $exception) {
            Log::error('Branch resolution failed unexpectedly.', [
                'address_length' => strlen((string) ($validated['address'] ?? '')),
                'coordinates' => $coordinates,
                'exception' => $exception,
            ]);

            return response()->json([
                'code' => 'BRANCH_RESOLUTION_ERROR',
                'message' => 'We could not resolve a delivery branch right now. Please try again shortly.',
            ], 500);
        }
    }

    public function diagnostics(Request $request)
    {
        $validated = $request->validate([
            'lat' => 'nullable|numeric|between:4,22',
            'lng' => 'nullable|numeric|between:116,127',
        ]);

        $coordinates = isset($validated['lat'], $validated['lng'])
            ? ['lat' => $validated['lat'], 'lng' => $validated['lng']]
            : null;

        return response()->json(['data' => $this->routing->diagnostics($coordinates)]);
    }
}
