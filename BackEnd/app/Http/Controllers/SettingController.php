<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\SystemSetting;
use App\Support\HttpCacheResponse;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class SettingController extends Controller
{
    use AdminAuthTrait;
    use HttpCacheResponse;

    public function index(Request $request)
    {
        return $this->cachedJsonResponse($request, ['settings' => app(\App\Services\PricingService::class)->settings()], 300);
    }

    public function update(Request $request)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        $validator = Validator::make($request->all(), [
            'delivery_base_fee' => 'sometimes|numeric|min:0',
            'delivery_base_distance_km' => 'sometimes|numeric|min:0',
            'delivery_per_km_rate' => 'sometimes|numeric|min:0',
            'delivery_free_subtotal' => 'sometimes|numeric|min:0',
            'delivery_max_fee' => 'sometimes|numeric|min:0',
            'service_fee_rate' => 'sometimes|numeric|min:0|max:1',
            'service_fee_min' => 'sometimes|numeric|min:0',
            'service_fee_max' => 'sometimes|numeric|min:0',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 422);
        foreach (['delivery_base_fee', 'delivery_base_distance_km', 'delivery_per_km_rate', 'delivery_free_subtotal', 'delivery_max_fee', 'service_fee_rate', 'service_fee_min', 'service_fee_max'] as $key) {
            if ($request->has($key)) SystemSetting::updateOrCreate(['key' => $key], ['value' => number_format((float) $request->input($key), 2, '.', '')]);
        }
        Cache::forget('system_pricing_settings');
        return response()->json(['settings' => app(\App\Services\PricingService::class)->settings()]);
    }
}