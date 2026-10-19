<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class NominatimGeocodingService
{
    private const BASE_URL = 'https://nominatim.openstreetmap.org';
    private const MIN_REQUEST_INTERVAL_MICROSECONDS = 1_100_000;

    public function search(string $query, int $limit = 1): array
    {
        return $this->request('search', [
            'format' => 'json',
            'q' => $query,
            'limit' => $limit,
            'countrycodes' => 'ph',
            'addressdetails' => 1,
            'accept-language' => 'en',
            'dedupe' => 1,
            'polygon' => 0,
        ]);
    }

    public function reverse(float $latitude, float $longitude): array
    {
        return $this->request('reverse', [
            'format' => 'json',
            'lat' => $latitude,
            'lon' => $longitude,
            'zoom' => 18,
            'addressdetails' => 1,
        ]);
    }

    private function request(string $endpoint, array $parameters): array
    {
        $cache = Cache::store('file');
        $cacheKey = 'nominatim:'.hash('sha256', $endpoint.'|'.json_encode($parameters));
        if ($cache->has($cacheKey)) {
            return $cache->get($cacheKey);
        }

        return $cache->lock('nominatim:outbound-request', 30)->block(30, function () use ($cache, $cacheKey, $endpoint, $parameters): array {
            if ($cache->has($cacheKey)) {
                return $cache->get($cacheKey);
            }

            $lastRequestAt = (float) $cache->get('nominatim:last-request-at', 0);
            $waitMicroseconds = max(
                0,
                self::MIN_REQUEST_INTERVAL_MICROSECONDS - (int) ((microtime(true) - $lastRequestAt) * 1_000_000),
            );
            if ($waitMicroseconds > 0) {
                usleep($waitMicroseconds);
            }
            $cache->put('nominatim:last-request-at', microtime(true), now()->addDay());

            $response = Http::acceptJson()
                ->withHeaders([
                    'User-Agent' => config('services.nominatim.user_agent', config('app.name').'/1.0'),
                    'Referer' => config('services.nominatim.referer', config('app.url')),
                    'Accept-Language' => 'en',
                ])
                ->connectTimeout(5)
                ->timeout(8)
                ->get(self::BASE_URL.'/'.$endpoint, $parameters);

            if (! $response->successful()) {
                Log::error('Nominatim request failed.', [
                    'endpoint' => $endpoint,
                    'status' => $response->status(),
                    'query_length' => strlen((string) ($parameters['q'] ?? '')),
                ]);
                throw new RuntimeException('The address lookup service returned HTTP '.$response->status().'.');
            }

            $data = $response->json();
            if (! is_array($data)) {
                Log::error('Nominatim returned an invalid response.', ['endpoint' => $endpoint]);
                throw new RuntimeException('The address lookup service returned an invalid response.');
            }

            if ($data !== []) {
                $cache->put($cacheKey, $data, now()->addDay());
            }
            return $data;
        });
    }
}
