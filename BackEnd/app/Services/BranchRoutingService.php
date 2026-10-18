<?php

namespace App\Services;

use App\Models\Franchise;
use App\Models\Addon;
use App\Models\Order;
use Illuminate\Support\Facades\Log;

class BranchRoutingService
{
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
        $allBranches->each(function (Franchise $branch): void {
            if ($branch->is_active && $branch->delivery_enabled && ! $this->validBranchCoordinates($branch)) {
                Log::warning('Active delivery branch is excluded from routing because its coordinates are missing or invalid.', [
                    'branch_id' => $branch->id,
                    'branch_name' => $branch->name,
                    'latitude' => $branch->latitude,
                    'longitude' => $branch->longitude,
                ]);
            }
        });

        $branches = $allBranches
            ->where('is_active', true)
            ->where('status', 'active')
            ->where('accepts_online_orders', true)
            ->where('delivery_enabled', true)
            ->where(function ($query) {
                $query->whereNull('franchise_account_id')
                    ->orWhereHas('franchiseAccount', fn ($account) => $account->where('status', 'active'));
            })
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get()
            ->filter(fn (Franchise $branch) => $this->validBranchCoordinates($branch));

        $loads = Order::whereIn('branch_id', $branches->pluck('id'))
            ->whereIn('status', ['pending', 'confirmed', 'preparing', 'prepared', 'ready'])
            ->selectRaw('branch_id, COUNT(*) as total')
            ->groupBy('branch_id')
            ->pluck('total', 'branch_id');

        $branches = $branches
            ->map(fn (Franchise $branch) => [
                'branch' => $branch,
                'distance' => $this->distance($branch, $coordinates),
                'open' => $this->isOpen($branch),
                'load' => (int) ($loads[$branch->id] ?? 0),
            ])
            ->filter(fn (array $candidate) => $candidate['branch']->delivery_radius_km === null || $candidate['distance'] <= (float) $candidate['branch']->delivery_radius_km)
            ->sort(function (array $left, array $right) {
                if (abs($left['distance'] - $right['distance']) > 0.001) return $left['distance'] <=> $right['distance'];
                if ($left['open'] !== $right['open']) return $left['open'] ? -1 : 1;
                if ($left['load'] !== $right['load']) return $left['load'] <=> $right['load'];
                return strcmp((string) $left['branch']->id, (string) $right['branch']->id);
            })
            ->values();

        $selected = $branches->first(fn (array $candidate) => $candidate['open']);
        if (! $selected) throw new \InvalidArgumentException('Sorry, we do not deliver to this address yet.');

        $result = $this->payload($selected['branch'], $selected['distance'], $branches->first()['branch']->id !== $selected['branch']->id ? 'Your nearest branch is temporarily unavailable. We assigned the next available branch.' : null);
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
            $open = $this->isOpen($branch);
            if (! $open) $reasons[] = 'currently closed';

            $distance = $coordinates && $this->validBranchCoordinates($branch)
                ? round($this->distance($branch, $coordinates), 3)
                : null;
            if ($distance !== null && $branch->delivery_radius_km !== null && $distance > (float) $branch->delivery_radius_km) {
                $reasons[] = 'outside delivery radius';
            }

            return [
                'id' => $branch->id,
                'name' => $branch->name,
                'latitude' => $branch->latitude,
                'longitude' => $branch->longitude,
                'is_active' => $branch->is_active,
                'status' => $branch->status,
                'accepts_online_orders' => $branch->accepts_online_orders,
                'delivery_enabled' => $branch->delivery_enabled,
                'delivery_radius_km' => $branch->delivery_radius_km,
                'distance_km' => $distance,
                'open' => $open,
                'eligible' => ! array_intersect($reasons, ['inactive', 'online orders disabled', 'delivery disabled', 'franchise account inactive', 'missing or invalid coordinates', 'outside delivery radius']),
                'exclusion_reasons' => $reasons,
            ];
        })->values()->all();
    }

    public function validateCatalog(string $branchId, array $items): array
    {
        $catalog = app(FranchiseInventoryService::class)->catalog($branchId, true)->keyBy('id');
        $unavailable = collect($items)
            ->filter(fn (array $item) => ! $catalog->has($item['product_id'] ?? null))
            ->map(fn (array $item) => $item['product_name'] ?? $item['product_id'] ?? 'Item')
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
