<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NominatimGeocodingTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_uses_a_cached_nominatim_proxy_request_with_app_identification(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/search*' => Http::response([
                ['lat' => '14.3194', 'lon' => '120.9943', 'display_name' => 'Dasmarinas, Cavite'],
            ]),
        ]);

        $query = 'Nominatim test '.uniqid('', true);
        $this->getJson('/api/geo/nominatim/search?q='.urlencode($query).'&limit=1')
            ->assertOk()
            ->assertJsonPath('0.lat', '14.3194');
        $this->getJson('/api/geo/nominatim/search?q='.urlencode($query).'&limit=1')
            ->assertOk();

        Http::assertSentCount(1);
        Http::assertSent(function ($request): bool {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
            return str_contains($request->url(), 'nominatim.openstreetmap.org/search')
                && $request->header('User-Agent') !== []
                && $request->header('Referer') !== []
                && ($query['countrycodes'] ?? null) === 'ph';
        });
    }
}
