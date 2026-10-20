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
        $cacheKey = 'geocode:v3:'.md5(mb_strtolower($address));
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
            'isBroad' => true,
        ], $result);
        $this->assertSame($result, $geocoding->geocodeAddress($address));

        Cache::store('file')->forget($cacheKey);
    }

    public function test_it_marks_a_province_only_match_as_broad(): void
    {
        $address = 'Laguna, Calabarzon, Philippines';
        $cacheKey = 'geocode:v3:'.md5(mb_strtolower($address));
        Cache::store('file')->forget($cacheKey);

        $this->mock(NominatimGeocodingService::class)
            ->shouldReceive('search')
            ->once()
            ->with($address, 1)
            ->andReturn([[
                'lat' => '14.1667',
                'lon' => '121.3333',
                'address' => [
                    'county' => 'Laguna',
                    'state' => 'Calabarzon',
                    'country' => 'Philippines',
                ],
            ]]);

        $result = app(GeocodingService::class)->geocodeAddress($address);

        $this->assertTrue($result['isBroad']);
        Cache::store('file')->forget($cacheKey);
    }

    public function test_it_marks_a_town_centroid_as_broad_even_when_the_full_query_matched(): void
    {
        $address = 'Bulakan, Bulacan, Central Luzon, 3017, Philippines';
        $cacheKey = 'geocode:v3:'.md5(mb_strtolower($address));
        Cache::store('file')->forget($cacheKey);

        $this->mock(NominatimGeocodingService::class)
            ->shouldReceive('search')
            ->once()
            ->with($address, 1)
            ->andReturn([[
                'lat' => '14.7946733',
                'lon' => '120.8792703',
                'type' => 'town',
                'address' => [
                    'town' => 'Bulakan',
                    'county' => 'Bulacan',
                    'state' => 'Central Luzon',
                    'postcode' => '3017',
                    'country' => 'Philippines',
                ],
            ]]);

        $result = app(GeocodingService::class)->geocodeAddress($address);

        $this->assertSame(14.7946733, $result['lat']);
        $this->assertSame(120.8792703, $result['lng']);
        $this->assertTrue($result['isBroad']);
        Cache::store('file')->forget($cacheKey);
    }
}
