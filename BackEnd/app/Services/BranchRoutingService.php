<?php

namespace App\Services;

use App\Models\Franchise;
use App\Models\Addon;
use App\Models\Order;

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

        $branches = Franchise::with('franchiseAccount')
            ->where('is_active', true)
            ->where('status', 'active')
            ->where('accepts_online_orders', true)
            ->where('delivery_enabled', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get();

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
                return $left['load'] <=> $right['load'];
            })
            ->values();

        $selected = $branches->first(fn (array $candidate) => $candidate['open']);
        if (! $selected) throw new \InvalidArgumentException('Sorry, we do not deliver to this address yet.');

        return $this->payload($selected['branch'], $selected['distance'], $branches->first()['branch']->id !== $selected['branch']->id ? 'Your nearest branch is temporarily unavailable. We assigned the next available branch.' : null);
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
