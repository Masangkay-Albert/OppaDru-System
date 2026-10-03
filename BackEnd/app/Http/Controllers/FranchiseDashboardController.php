<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class FranchiseDashboardController extends Controller
{
    public function index(Request $request)
    {
        $franchiseUser = $request->user();

        if (!$franchiseUser || !$franchiseUser->franchise_id) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'data' => [
                'franchise_id' => $franchiseUser->franchise_id,
                'franchise_name' => optional($franchiseUser->franchise)->name,
            ],
        ]);
    }
}
