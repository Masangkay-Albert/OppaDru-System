<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Support\StoreHours;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StoreHoursController extends Controller
{
    public function show()
    {
        return response()
            ->json(StoreHours::status())
            ->header('Cache-Control', 'no-store');
    }

    public function simulation()
    {
        $simulation = StoreHours::simulationSettings();
        $timezone = (string) config('store_hours.timezone');
        $simulatedAt = $simulation['simulated_at']
            ? CarbonImmutable::parse($simulation['simulated_at'], $timezone)->setTimezone($timezone)->format('Y-m-d\TH:i')
            : null;

        return response()->json([
            'enabled' => $simulation['enabled'],
            'simulated_at' => $simulatedAt,
            'real_server_time' => StoreHours::getCurrentStoreTime(false)->format('Y-m-d\TH:i'),
        ])->header('Cache-Control', 'no-store');
    }

    public function updateSimulation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'enabled' => ['required', 'boolean'],
            'simulated_at' => ['nullable', 'date_format:Y-m-d\TH:i'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'The ordering-hours simulation settings are invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $previous = StoreHours::simulationSettings();
        $enabled = $request->boolean('enabled');
        $inputTime = $request->input('simulated_at');
        if (! is_string($inputTime) || $inputTime === '') {
            $inputTime = $previous['simulated_at'];
        }
        if ($enabled && (! is_string($inputTime) || $inputTime === '')) {
            return response()->json(['message' => 'Choose a simulated date and time before enabling simulation.'], 422);
        }

        $timezone = (string) config('store_hours.timezone');
        $simulatedAt = $inputTime
            ? CarbonImmutable::parse($inputTime, $timezone)->setTimezone($timezone)->toIso8601String()
            : null;
        $realAnchorAt = $enabled ? StoreHours::getCurrentStoreTime(false)->toIso8601String() : null;
        $value = json_encode([
            'enabled' => $enabled,
            'simulated_at' => $simulatedAt,
            'real_anchor_at' => $realAnchorAt,
        ], JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($value): void {
            SystemSetting::updateOrCreate(
                ['key' => 'store_hours_simulation', 'franchise_id' => null],
                ['value' => $value, 'franchise_id' => null],
            );
        });

        return response()->json(['message' => 'Ordering-hours simulation settings saved.']);
    }
}
