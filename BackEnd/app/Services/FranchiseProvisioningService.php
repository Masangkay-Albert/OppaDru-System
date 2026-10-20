<?php

namespace App\Services;

use App\Models\Franchise;
use App\Models\FranchiseApplication;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class FranchiseProvisioningService
{
    public function __construct(private readonly GeocodingService $geocoding) {}

    public function provisionOnApproval(FranchiseApplication $application): ?Franchise
    {
        $franchise = $application->franchise_id
            ? Franchise::query()->whereKey($application->franchise_id)->lockForUpdate()->first()
            : null;
        $hasCoordinates = $franchise
            && is_numeric($franchise->latitude)
            && is_numeric($franchise->longitude)
            && (float) $franchise->latitude >= 4
            && (float) $franchise->latitude <= 22
            && (float) $franchise->longitude >= 116
            && (float) $franchise->longitude <= 127;
        $location = trim((string) $application->location);
        $hasApplicationPin = is_numeric($application->proposed_latitude)
            && is_numeric($application->proposed_longitude)
            && app(BranchRoutingService::class)->validBranchCoordinatePair(
                $application->proposed_latitude,
                $application->proposed_longitude,
            );
        $coordinates = $hasApplicationPin
            ? [
                'lat' => (float) $application->proposed_latitude,
                'lng' => (float) $application->proposed_longitude,
                'matchedQuery' => 'administrator-confirmed map pin',
                'isBroad' => false,
            ]
            : ($hasCoordinates
                ? ['lat' => (float) $franchise->latitude, 'lng' => (float) $franchise->longitude, 'matchedQuery' => 'existing coordinates', 'isBroad' => false]
                : ($location === '' ? null : $this->geocoding->geocodeAddress($location.', Philippines')));
        if (($coordinates['isBroad'] ?? false) === true) {
            $coordinates = null;
        }
        $hasValidResult = $coordinates
            && is_finite((float) $coordinates['lat'])
            && is_finite((float) $coordinates['lng'])
            && (float) $coordinates['lat'] >= 4
            && (float) $coordinates['lat'] <= 22
            && (float) $coordinates['lng'] >= 116
            && (float) $coordinates['lng'] <= 127;
        if (! $hasValidResult) {
            $coordinates = null;
        }

        if (! $coordinates) {
            Log::warning('Approved franchise is pending location provisioning.', [
                'application_id' => $application->id,
                'franchise_account_id' => $application->franchise_account_id,
                'query_level' => 'unresolved',
            ]);

            if ($franchise) {
                $franchise->forceFill([
                    'location_status' => 'needs_location',
                    'location_error' => 'The proposed branch address could not be geocoded.',
                ])->save();
            }

            return null;
        }

        $name = trim((string) $application->franchise_name) ?: 'Oppa Dru Franchise';
        $franchise ??= new Franchise();
        $franchise->forceFill([
            'franchise_account_id' => $application->franchise_account_id,
            'name' => $name,
            'slug' => $franchise->slug ?: $this->uniqueSlug($name.' '.$location),
            'email' => strtolower(trim((string) $application->email)),
            'phone' => $application->phone,
            'address' => $location,
            'status' => 'active',
            'is_active' => true,
            'accepts_online_orders' => true,
            'delivery_enabled' => true,
            'delivery_radius_km' => config('delivery.default_radius_km'),
            'latitude' => $coordinates['lat'],
            'longitude' => $coordinates['lng'],
            'location_status' => $hasApplicationPin || ($hasCoordinates && $franchise->location_status === 'manual') ? 'manual' : 'geocoded',
            'location_error' => null,
            'owner_admin_id' => $application->approved_by_admin_id,
            'metadata' => array_merge($franchise->metadata ?? [], [
                'application_id' => $application->id,
                'application_reference' => $application->reference_number,
                'proposed_location' => $location,
                'geocoding_matched_query' => $coordinates['matchedQuery'],
            ]),
        ])->saveOrFail();

        app(FranchiseInventoryService::class)->initializeBranchMenu((string) $franchise->id);

        $franchise->refresh();
        if ($franchise->latitude === null || $franchise->longitude === null) {
            throw new \RuntimeException('Franchise coordinates did not persist after provisioning.');
        }

        Log::info('Approved franchise location provisioned.', [
            'application_id' => $application->id,
            'franchise_account_id' => $application->franchise_account_id,
            'franchise_id' => $franchise->id,
            'matched_query' => $coordinates['matchedQuery'],
        ]);

        return $franchise;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'franchise';
        $slug = $base;
        $suffix = 2;
        while (Franchise::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
