<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettingController extends Controller
{
    public function index()
    {
        return response()->json(['settings' => app(\App\Services\PricingService::class)->settings()]);
    }

    public function update(Request $request)
    {
        $token = $request->bearerToken();
        if (!$token || !Admin::where('api_token', hash('sha256', $token))->exists()) return response()->json(['message' => 'Unauthorized'], 401);
        $validator = Validator::make($request->all(), [
            'service_fee' => 'sometimes|numeric|min:0',
            'delivery_fee_standard' => 'sometimes|numeric|min:0',
            'delivery_fee_priority' => 'sometimes|numeric|min:0',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 422);
        foreach (['service_fee', 'delivery_fee_standard', 'delivery_fee_priority'] as $key) {
            if ($request->has($key)) SystemSetting::updateOrCreate(['key' => $key], ['value' => number_format((float) $request->input($key), 2, '.', '')]);
        }
        return $this->index();
    }
}