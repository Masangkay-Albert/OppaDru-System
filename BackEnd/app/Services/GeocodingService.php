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

        $cacheKey = 'geocode:v4:'.md5(mb_strtolower($normalized));
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

        $broadResult = null;
        foreach ($levels as $level) {
            $variants = array_values(array_unique([$level, trim(Str::ascii($level))]));
            foreach ($variants as $query) {
                if ($query === '') {
                    continue;
                }

                try {
                    $results = $this->nominatim->search($query, 5);
                    foreach ($results as $result) {
                        $latitude = isset($result['lat']) ? (float) $result['lat'] : null;
                        $longitude = isset($result['lon']) ? (float) $result['lon'] : null;
                        if ($latitude === null || $longitude === null || ! is_finite($latitude) || ! is_finite($longitude)) {
                            continue;
                        }

                        $resolved = [
                            'lat' => $latitude,
                            'lng' => $longitude,
                            'matchedQuery' => $query,
                            'isBroad' => $this->isBroadResult($result),
                        ];
                        if (! $resolved['isBroad']) {
                            return $this->cacheResult($cache, $cacheKey, $resolved);
                        }
                        $broadResult ??= $resolved;
                    }
                } catch (Throwable $exception) {
                    Log::warning('Address geocoding attempt failed.', [
                        'address_hash' => $cacheKey,
                        'query_hash' => md5(mb_strtolower($query)),
                        'exception' => $exception->getMessage(),
                    ]);
                }
            }
        }

        return $broadResult ? $this->cacheResult($cache, $cacheKey, $broadResult) : null;
    }

    private function isBroadResult(array $result): bool
    {
        $featureClass = strtolower((string) ($result['class'] ?? ''));
        $featureType = strtolower((string) ($result['type'] ?? ''));
        $broadTypes = ['administrative', 'city', 'county', 'municipality', 'province', 'region', 'state', 'town', 'village'];
        if (in_array($featureType, $broadTypes, true)) {
            return true;
        }
        if (($featureClass !== '' && ! in_array($featureClass, ['place', 'boundary'], true))
            || ($featureType !== '' && ! in_array($featureType, $broadTypes, true))) {
            return false;
        }

        $address = $result['address'] ?? null;
        if (! is_array($address)) {
            return true;
        }

        foreach ([
            'house_number',
            'road',
            'neighbourhood',
            'suburb',
            'quarter',
            'city_district',
            'building',
            'amenity',
            'shop',
            'industrial',
            'retail',
        ] as $detail) {
            if (isset($address[$detail]) && trim((string) $address[$detail]) !== '') {
                return false;
            }
        }

        return true;
    }

    private function cacheResult(mixed $cache, string $cacheKey, array $resolved): array
    {
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
    }
}
