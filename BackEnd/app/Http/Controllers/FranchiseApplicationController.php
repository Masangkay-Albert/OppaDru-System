<?php

namespace App\Http\Controllers;

use App\Http\Controllers\FranchiseApplication\FranchiseApplicationActivationActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationAdminReviewActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationApplicantActions;
use App\Http\Controllers\FranchiseApplication\FranchiseApplicationOpportunityActions;
use App\Models\FranchiseApplication;
use App\Models\FranchiseApplicationEvent;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FranchiseApplicationController extends Controller
{
    use AdminAuthTrait;
    use FranchiseApplicationActivationActions;
    use FranchiseApplicationAdminReviewActions;
    use FranchiseApplicationApplicantActions;
    use FranchiseApplicationOpportunityActions;

    private function extractGeoOptions(mixed $payload): array
    {
        $items = $payload;
        if (is_array($payload) && array_key_exists('data', $payload) && is_array($payload['data'])) {
            $items = $payload['data'];
        }
        if (! is_array($items)) {
            return [];
        }

        return collect($items)
            ->map(function ($item) {
                if (! is_array($item)) {
                    return null;
                }

                $code = (string) ($item['code'] ?? $item['province_code'] ?? $item['city_code'] ?? $item['id'] ?? '');
                $name = (string) ($item['name'] ?? $item['province_name'] ?? $item['city_name'] ?? $item['municipality_name'] ?? $item['province'] ?? $item['municipality'] ?? '');

                if ($code === '' || $name === '') {
                    return null;
                }

                return ['code' => trim($code), 'name' => trim($name)];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function fetchPsgcGeo(string $endpoint, array $parameters = []): array
    {
        $response = Http::acceptJson()->timeout(20)->get($endpoint, $parameters);
        if ($response->failed()) {
            return [];
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return [];
        }

        return $this->extractGeoOptions($payload);
    }

    public function provinces(): \Illuminate\Http\JsonResponse
    {
        $data = Cache::remember('psgc_provinces', now()->addDay(), function () {
            return $this->fetchPsgcGeo('https://psgc.cloud/api/provinces', ['per_page' => 1000]);
        });

        return response()->json(['data' => $data]);
    }

    public function cities(Request $request): \Illuminate\Http\JsonResponse
    {
        $provinceCode = trim((string) $request->query('province_code', ''));
        if ($provinceCode === '') {
            return response()->json(['data' => [], 'message' => 'A province code is required.'], 422);
        }

        $data = Cache::remember('psgc_cities_'.$provinceCode, now()->addDay(), function () use ($provinceCode) {
            $primary = $this->fetchPsgcGeo("https://psgc.cloud/api/provinces/{$provinceCode}/cities-municipalities", ['per_page' => 1000]);
            if ($primary !== []) {
                return $primary;
            }

            return $this->fetchPsgcGeo("https://psgc.cloud/api/provinces/{$provinceCode}/cities", ['per_page' => 1000]);
        });

        return response()->json(['data' => $data]);
    }

    public function barangays(Request $request): \Illuminate\Http\JsonResponse
    {
        $cityCode = trim((string) $request->query('city_code', ''));
        if ($cityCode === '') {
            return response()->json(['data' => [], 'message' => 'A city or municipality code is required.'], 422);
        }

        $data = Cache::remember('psgc_barangays_'.$cityCode, now()->addDay(), function () use ($cityCode) {
            $primary = $this->fetchPsgcGeo("https://psgc.cloud/api/cities-municipalities/{$cityCode}/barangays", ['per_page' => 1000]);
            if ($primary !== []) {
                return $primary;
            }

            return $this->fetchPsgcGeo("https://psgc.cloud/api/cities/{$cityCode}/barangays", ['per_page' => 1000]);
        });

        return response()->json(['data' => $data]);
    }

    private function recordEvent(
        FranchiseApplication $application,
        string $actorType,
        string|int|null $actorId,
        ?string $status,
        string $title,
        ?string $message,
        bool $internal = false,
    ): void {
        FranchiseApplicationEvent::create([
            'application_id' => $application->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId === null ? null : (string) $actorId,
            'status' => $status,
            'title' => $title,
            'message' => $message,
            'is_internal' => $internal,
            'created_at' => now(),
        ]);
    }
}
