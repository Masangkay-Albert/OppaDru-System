<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\TargetProfitSale;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TargetProfitSaleController extends Controller
{
    use AdminAuthTrait;

    public function show(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => TargetProfitSale::where('singleton_key', 'default')->first(),
        ]);
    }

    public function update(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'target_amount' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $target = TargetProfitSale::updateOrCreate(
            ['singleton_key' => 'default'],
            ['target_amount' => $request->input('target_amount')]
        );

        return response()->json(['data' => $target]);
    }

    public function destroy(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        TargetProfitSale::where('singleton_key', 'default')->delete();
        return response()->json(['data' => null]);
    }
}