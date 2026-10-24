<?php

namespace App\Services;

use App\Models\Franchise;
use App\Models\Addon;
use App\Models\Order;
use Illuminate\Support\Facades\Log;

class BranchRoutingService
{
    public const NO_BRANCH_COORDINATES_MESSAGE = 'No delivery branches have location coordinates configured yet.';
    public const NO_ELIGIBLE_DELIVERY_BRANCH_MESSAGE = 'No branch is currently accepting online deliveries.';

    public function resolve(?array $coordinates, ?string $requestedBranchId = null, bool $pickup = false): array
    {
        if ($pickup) {
            $branch = Franchise::with('franchiseAccount')->whereKey($requestedBranchId)->first();
            if (! $branch || ! $branch->isOperationallyActive() || ! $branch->accepts_online_orders) {
                throw new \InvalidArgumentException('Please choose an active branch for pickup.');
            }

            return $this->payload($branch, $coordinates ? $this->distance($branch, $coordinates) : 0.0);
        }

        if (! $coordinates || ! isset($coordinates['lat'], $coordinates['lng'])) {
            throw new \InvalidArgumentException('Please pin your delivery location so we can find the nearest branch.');
        }
        $this->assertDeliveryCoordinates($coordinates);

        $allBranches = Franchise::with('franchiseAccount')->get();
        $diagnostics = collect($this->diagnostics($coordinates))->keyBy('id');
        foreach ($diagnostics as $diagnostic) {
            if ($diagnostic['exclusion_reason'] !== null) {
                Log::warning('A franchise branch is excluded from delivery routing.', $diagnostic);
            }
        }

        if (! $allBranches->contains(fn (Franchise $branch) => $this->validBranchCoordinates($branch))) {
            Log::warning('Delivery branch resolution has no franchise rows with valid coordinates.', [
                'customer_coordinates' => ['lat' => (float) $coordinates['lat'], 'lng' => (float) $coordinates['lng']],
                'branches' => $diagnostics->values()->all(),
            ]);
            throw new \InvalidArgumentException(self::NO_BRANCH_COORDINATES_MESSAGE);
        }

        $branches = $allBranches->filter(fn (Franchise $branch) => $this->hasDeliveryEligibility($branch));
        if ($branches->isEmpty()) {
            Log::warning('Delivery branch resolution has no eligible active delivery branches.', [
                'customer_coordinates' => ['lat' => (float) $coordinates['lat'], 'lng' => (float) $coordinates['lng']],
                'branches' => $diagnostics->values()->all(),
            ]);
            throw new \InvalidArgumentException(self::NO_ELIGIBLE_DELIVERY_BRANCH_MESSAGE);
        }

        $loads = Order::whereIn('branch_id', $branches->pluck('id'))
            ->whereIn('status', ['pending', 'confirmed', 'preparing', 'prepared', 'ready'])
            ->selectRaw('branch_id, COUNT(*) as total')
            ->groupBy('branch_id')
            ->pluck('total', 'branch_id');

        $evaluatedBranches = $branches
            ->map(fn (Franchise $branch) => [
                'branch' => $branch,
                'distance' => $this->distance($branch, $coordinates),
                'radius' => $this->deliveryRadius($branch),
                'open' => $this->isOpen($branch),
                'load' => (int) ($loads[$branch->id] ?? 0),
            ]);

        $withinRange = $evaluatedBranches
            ->filter(fn (array $candidate) => $candidate['distance'] <= $candidate['radius'])
            ->sort(function (array $left, array $right) {
                if ($left['distance'] !== $right['distance']) return $left['distance'] <=> $right['distance'];
                if ($left['open'] !== $right['open']) return $left['open'] ? -1 : 1;
                if ($left['load'] !== $right['load']) return $left['load'] <=> $right['load'];
                return strcmp((string) $left['branch']->id, (string) $right['branch']->id);
            })
            ->values();

        $selected = $withinRange->first();
        if (! $selected) {
            $nearest = $evaluatedBranches->sortBy('distance')->first();
            $nearestBranch = $nearest['branch'];
            $nearestMessage = sprintf(
                'Nearest branch is %s, %.1f km away. Your address is outside its %.1f km delivery area. Please choose an address closer to a branch.',
                $nearestBranch->name,
                $nearest['distance'],
                $nearest['radius'],
            );
            Log::warning('No eligible delivery branch is within range of the selected address.', [
                'customer_coordinates' => ['lat' => (float) $coordinates['lat'], 'lng' => (float) $coordinates['lng']],
                'branches' => $diagnostics->values()->all(),
            ]);
            throw new \InvalidArgumentException($nearestMessage);
        }
        if (! $selected['open']) {
            throw new \InvalidArgumentException('The nearest branch is currently closed. Please try again during branch hours.');
        }

        $result = $this->payload($selected['branch'], $selected['distance']);
        if (config('app.debug')) {
            $result['branch_diagnostics'] = $this->diagnostics($coordinates);
        }
        return $result;
    }

    public function diagnostics(?array $coordinates = null): array
    {
        if ($coordinates !== null) {
            $this->assertDeliveryCoordinates($coordinates);
        }

        return Franchise::with('franchiseAccount')->get()->map(function (Franchise $branch) use ($coordinates) {
            $reasons = [];
            if (! $branch->is_active || $branch->status !== 'active') $reasons[] = 'inactive';
            if (! $branch->accepts_online_orders) $reasons[] = 'online orders disabled';
            if (! $branch->delivery_enabled) $reasons[] = 'delivery disabled';
            if ($branch->franchise_account_id && $branch->franchiseAccount?->status !== 'active') $reasons[] = 'franchise account inactive';
            if (! $this->validBranchCoordinates($branch)) $reasons[] = 'missing or invalid coordinates';
            if (! $this->validDeliveryRadius($branch)) $reasons[] = 'invalid delivery radius';
            $open = $this->isOpen($branch);
            if (! $open) $reasons[] = 'currently closed';

            $distance = $coordinates && $this->validBranchCoordinates($branch)
                ? round($this->distance($branch, $coordinates), 3)
                : null;
            $deliveryRadius = $this->deliveryRadius($branch);
            if ($distance !== null && $distance > $deliveryRadius) {
                $reasons[] = 'outside delivery radius';
            }

            return [
                'id' => $branch->id,
                'name' => $branch->name,
                'franchise_account_id' => $branch->franchise_account_id,
                'latitude' => $branch->latitude,
                'longitude' => $branch->longitude,
                'is_active' => $branch->is_active,
                'status' => $branch->status,
                'accepts_online_orders' => $branch->accepts_online_orders,
                'delivery_enabled' => $branch->delivery_enabled,
                'delivery_radius_km' => $deliveryRadius,
                'distance_km' => $distance,
                'open' => $open,
                'eligible' => ! array_intersect($reasons, ['inactive', 'online orders disabled', 'delivery disabled', 'franchise account inactive', 'missing or invalid coordinates', 'invalid delivery radius', 'outside delivery radius', 'currently closed']),
                'exclusion_reasons' => $reasons,
                'exclusion_reason' => $reasons ? implode(', ', $reasons) : null,
            ];
        })->values()->all();
    }

    private function deliveryRadius(Franchise $branch): float
    {
        $configuredRadius = $branch->delivery_radius_km;
        $radius = $configuredRadius === null
            ? config('delivery.default_radius_km')
            : $configuredRadius;

        return min(100.0, max(0.0, (float) $radius));
    }

    private function hasDeliveryEligibility(Franchise $branch): bool
    {
        return $branch->is_active
            && $branch->status === 'active'
            && $branch->accepts_online_orders
            && $branch->delivery_enabled
            && (! $branch->franchise_account_id || $branch->franchiseAccount?->status === 'active')
            && $this->validBranchCoordinates($branch)
            && $this->validDeliveryRadius($branch);
    }

    private function validDeliveryRadius(Franchise $branch): bool
    {
        $configuredRadius = $branch->delivery_radius_km ?? config('delivery.default_radius_km');

        return is_numeric($configuredRadius)
            && is_finite((float) $configuredRadius)
            && (float) $configuredRadius > 0
            && (float) $configuredRadius <= 100;
    }

    public function validateCatalog(string $branchId, array $items): array
    {
        $catalog = app(FranchiseInventoryService::class)->catalog($branchId)->keyBy('id');
        $unavailable = collect($items)
            ->filter(function (array $item) use ($catalog): bool {
                $product = $catalog->get($item['product_id'] ?? null);
                return ! $product || ! ($product['branch_available'] ?? false);
            })
            ->map(fn (array $item) => $item['product_name'] ?? data_get($catalog->get($item['product_id'] ?? null), 'name') ?? $item['product_id'] ?? 'Item')
            ->values()
            ->all();

        $addonIds = collect($items)->flatMap(fn (array $item) => collect($item['selected_addons'] ?? [])->pluck('id'))->filter()->unique()->values();
        if ($addonIds->isNotEmpty()) {
            $availableAddonIds = Addon::query()
                ->whereIn('id', $addonIds)
                ->where('is_active', true)
                ->where(function ($query) use ($branchId) {
                    $query->where('franchise_id', $branchId)->orWhereNull('franchise_id');
                })
                ->pluck('id');
            if ($availableAddonIds->count() !== $addonIds->count()) $unavailable[] = 'One or more selected add-ons';
        }
        return $unavailable;
    }

    private function payload(Franchise $branch, float $distance, ?string $notice = null): array
    {
        return ['branch' => $branch, 'distance_km' => round($distance, 3), 'notice' => $notice];
    }

    private function distance(Franchise $branch, array $coordinates): float
    {
        $latDelta = deg2rad((float) $coordinates['lat'] - (float) $branch->latitude);
        $lngDelta = deg2rad((float) $coordinates['lng'] - (float) $branch->longitude);
        $originLat = deg2rad((float) $branch->latitude);
        $destinationLat = deg2rad((float) $coordinates['lat']);
        $a = sin($latDelta / 2) ** 2 + cos($originLat) * cos($destinationLat) * sin($lngDelta / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function validBranchCoordinates(Franchise $branch): bool
    {
        return is_numeric($branch->latitude) && is_numeric($branch->longitude)
            && (float) $branch->latitude >= 4 && (float) $branch->latitude <= 22
            && (float) $branch->longitude >= 116 && (float) $branch->longitude <= 127;
    }

    public function validBranchCoordinatePair(mixed $latitude, mixed $longitude): bool
    {
        return $this->validCoordinates($latitude, $longitude);
    }

    private function assertDeliveryCoordinates(array $coordinates): void
    {
        if (! $this->validCoordinates($coordinates['lat'] ?? null, $coordinates['lng'] ?? null)) {
            throw new \InvalidArgumentException('Please pin a valid delivery location in the Philippines.');
        }
    }

    private function validCoordinates(mixed $latitude, mixed $longitude): bool
    {
        return is_numeric($latitude) && is_numeric($longitude)
            && (float) $latitude >= 4 && (float) $latitude <= 22
            && (float) $longitude >= 116 && (float) $longitude <= 127;
    }

    private function isOpen(Franchise $branch): bool
    {
        $hours = data_get($branch->metadata, 'operating_hours');
        if (! is_array($hours)) return true;
        $day = strtolower(now('Asia/Manila')->format('l'));
        $today = $hours[$day] ?? null;
        if (! is_array($today) || empty($today['open']) || empty($today['close'])) return false;
        $now = now('Asia/Manila')->format('H:i');
        return $now >= $today['open'] && $now <= $today['close'];
    }
}
