<?php

namespace Tests\Unit;

use App\Services\GeocodingService;
use App\Services\NominatimGeocodingService;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class GeocodingServiceTest extends TestCase
{
    public function test_it_retries_simplified_and_ascii_addresses_and_caches_a_success(): void
    {
        $address = 'Viva Homes, Salawag, Dasmariñas, Cavite';
        $cacheKey = 'geocode:'.md5(mb_strtolower($address));
        Cache::store('file')->forget($cacheKey);

        $nominatim = $this->mock(NominatimGeocodingService::class);
        $nominatim->shouldReceive('search')
            ->once()
            ->with($address, 1)
            ->andReturn([]);
        $nominatim->shouldReceive('search')
            ->once()
            ->with('Viva Homes, Salawag, Dasmarinas, Cavite', 1)
            ->andReturn([]);
        $nominatim->shouldReceive('search')
            ->once()
            ->with('Salawag, Dasmariñas, Cavite', 1)
            ->andReturn([['lat' => '14.3194', 'lon' => '120.9943']]);

        $geocoding = app(GeocodingService::class);
        $result = $geocoding->geocodeAddress($address);

        $this->assertSame([
            'lat' => 14.3194,
            'lng' => 120.9943,
            'matchedQuery' => 'Salawag, Dasmariñas, Cavite',
        ], $result);
        $this->assertSame($result, $geocoding->geocodeAddress($address));

        Cache::store('file')->forget($cacheKey);
    }
}
