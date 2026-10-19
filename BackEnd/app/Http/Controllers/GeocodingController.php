<?php

namespace App\Http\Controllers;

use App\Services\NominatimGeocodingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class GeocodingController extends Controller
{
    public function __construct(private readonly NominatimGeocodingService $geocoding) {}

    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => 'required|string|max:500',
            'limit' => 'sometimes|integer|min:1|max:15',
        ]);

        try {
            return response()->json($this->geocoding->search(
                trim($validated['q']),
                (int) ($validated['limit'] ?? 1),
            ));
        } catch (Throwable $exception) {
            Log::error('Address search proxy failed.', ['exception' => $exception]);
            return response()->json(['message' => 'Address lookup is temporarily unavailable.'], 502);
        }
    }

    public function reverse(Request $request)
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:4,22',
            'lon' => 'required|numeric|between:116,127',
        ]);

        try {
            return response()->json($this->geocoding->reverse(
                (float) $validated['lat'],
                (float) $validated['lon'],
            ));
        } catch (Throwable $exception) {
            Log::error('Reverse address lookup proxy failed.', ['exception' => $exception]);
            return response()->json(['message' => 'Address lookup is temporarily unavailable.'], 502);
        }
    }
}
