<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
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

        $admin = Admin::where('email', $request->email)->first();

        if (!$admin || !Hash::check($request->password, $admin->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = Str::random(60);
        $admin->api_token = hash('sha256', $token);
        $admin->save();

        $safe = $admin->makeHidden(['password', 'api_token']);

        return response()->json(['admin' => $safe, 'token' => $token, 'message' => 'Login successful']);
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $admin = Admin::where('api_token', hash('sha256', $token))->first();
            if ($admin) {
                $admin->api_token = null;
                $admin->save();
            }
        }

        return response()->json(['message' => 'Logout successful']);
    }
}
