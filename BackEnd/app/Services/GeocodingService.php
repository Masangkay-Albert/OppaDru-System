<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GeocodingService
{
    private const CACHE_TTL_DAYS = 7;

    public function __construct(private readonly NominatimGeocodingService $nominatim) {}

    /**
     * @return array{lat: float, lng: float, matchedQuery: string, isBroad: bool}|null
     */
    public function geocodeAddress(string $address): ?array
    {
        $normalized = trim((string) preg_replace('/\s+/u', ' ', $address));
        if ($normalized === '') {
            return null;
        }

        $cacheKey = 'geocode:v2:'.md5(mb_strtolower($normalized));
        $cache = null;
        try {
            $cache = Cache::store('file');
            if ($cache->has($cacheKey)) {
                return $cache->get($cacheKey);
            }
        } catch (Throwable $exception) {
            Log::warning('Address geocoding cache could not be read.', [
                'address_hash' => $cacheKey,
                'exception' => $exception->getMessage(),
            ]);
        }

        $parts = array_values(array_filter(array_map('trim', explode(',', $normalized))));
        $levels = [];
        for ($start = 0; $start < count($parts); $start++) {
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

                try {
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
                        'isBroad' => $this->isBroadResult($results[0]),
                    ];
                    if ($cache) {
                        try {
                            $cache->put($cacheKey, $resolved, now()->addDays(self::CACHE_TTL_DAYS));
                        } catch (Throwable $exception) {
                            Log::warning('Address geocoding result could not be cached.', [
                                'address_hash' => $cacheKey,
                                'exception' => $exception->getMessage(),
                            ]);
                        }
                    }
                    return $resolved;
                } catch (Throwable $exception) {
                    Log::warning('Address geocoding attempt failed.', [
                        'address_hash' => $cacheKey,
                        'query_hash' => md5(mb_strtolower($query)),
                        'exception' => $exception->getMessage(),
                    ]);
                }
            }
        }

        return null;
    }

    private function isBroadResult(array $result): bool
    {
        $address = $result['address'] ?? null;
        if (! is_array($address)) {
            return false;
        }

        foreach ([
            'house_number',
            'road',
            'neighbourhood',
            'suburb',
            'quarter',
            'city_district',
            'city',
            'town',
            'village',
            'municipality',
            'hamlet',
            'borough',
        ] as $detail) {
            if (isset($address[$detail]) && trim((string) $address[$detail]) !== '') {
                return false;
            }
        }

        return in_array($result['type'] ?? null, ['administrative', 'county', 'state', 'province', 'region'], true)
            || array_intersect(array_keys($address), ['county', 'state', 'state_district', 'region']) !== [];
    }
}
