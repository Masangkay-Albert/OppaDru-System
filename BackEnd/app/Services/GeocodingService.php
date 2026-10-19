<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GeocodingService
{
    private const CACHE_TTL_DAYS = 7;
    private const MAX_ADDRESS_LEVELS = 4;

    public function __construct(private readonly NominatimGeocodingService $nominatim) {}

    /**
     * @return array{lat: float, lng: float, matchedQuery: string}|null
     */
    public function geocodeAddress(string $address): ?array
    {
        $normalized = trim((string) preg_replace('/\s+/u', ' ', $address));
        if ($normalized === '') {
            return null;
        }

        $cache = Cache::store('file');
        $cacheKey = 'geocode:'.md5(mb_strtolower($normalized));
        if ($cache->has($cacheKey)) {
            return $cache->get($cacheKey);
        }

        try {
            $parts = array_values(array_filter(array_map('trim', explode(',', $normalized))));
            $levels = [];
            for ($start = 0; $start < count($parts) && count($levels) < self::MAX_ADDRESS_LEVELS; $start++) {
                $query = implode(', ', array_slice($parts, $start));
                if ($query !== '' && ! in_array($query, $levels, true)) {
                    $levels[] = $query;
                }
            }

            foreach ($levels as $level) {
                $variants = array_values(array_unique([$level, trim(Str::ascii($level))]));
                foreach ($variants as $query) {
                    if ($query === '') {
                        continue;
                    }
                    $results = $this->nominatim->search($query, 1);
                    $latitude = isset($results[0]['lat']) ? (float) $results[0]['lat'] : null;
                    $longitude = isset($results[0]['lon']) ? (float) $results[0]['lon'] : null;
                    if ($latitude === null || $longitude === null || ! is_finite($latitude) || ! is_finite($longitude)) {
                        continue;
                    }

                    $resolved = [
                        'lat' => $latitude,
                        'lng' => $longitude,
                        'matchedQuery' => $query,
                    ];
                    $cache->put($cacheKey, $resolved, now()->addDays(self::CACHE_TTL_DAYS));
                    return $resolved;
                }
            }
        } catch (Throwable $exception) {
            Log::warning('Address geocoding failed.', [
                'address_hash' => $cacheKey,
                'exception' => $exception->getMessage(),
            ]);
        }

        return null;
    }
}
