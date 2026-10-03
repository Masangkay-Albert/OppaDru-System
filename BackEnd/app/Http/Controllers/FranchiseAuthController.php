<?php

namespace App\Http\Controllers;

use App\Models\FranchiseUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FranchiseAuthController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $franchiseUser = FranchiseUser::where('email', strtolower(trim((string) $request->email)))->first();

        if (!$franchiseUser || !Hash::check($request->password, $franchiseUser->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$franchiseUser->is_active) {
            return response()->json(['message' => 'Franchise account inactive'], 403);
        }

        $token = Str::random(60);
        $franchiseUser->api_token = hash('sha256', $token);
        $franchiseUser->save();

        return response()->json([
            'franchise_user' => $franchiseUser->load('franchise')->makeHidden(['password', 'api_token']),
            'token' => $token,
            'message' => 'Franchise login successful',
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $franchiseUser = FranchiseUser::where('api_token', hash('sha256', $token))->first();
            if ($franchiseUser) {
                $franchiseUser->api_token = null;
                $franchiseUser->save();
            }
        }

        return response()->json(['message' => 'Logout successful']);
    }

    public function me(Request $request)
    {
        $franchiseUser = $request->user();

        if (!$franchiseUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'data' => $franchiseUser->load('franchise')->makeHidden(['password', 'api_token']),
        ]);
    }
}
