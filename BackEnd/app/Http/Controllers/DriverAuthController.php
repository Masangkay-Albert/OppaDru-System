<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class DriverAuthController extends Controller
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

        $driver = Driver::where('email', $request->email)->first();

        if (!$driver || !Hash::check($request->password, $driver->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (!$driver->isActive) {
            return response()->json(['message' => 'Account is inactive. Please contact admin.'], 403);
        }

        // Generate and save the manual token
        $token = Str::random(60);
        $driver->api_token = hash('sha256', $token);
        $driver->save();

        // Hide sensitive data before sending to React
        $safe = $driver->makeHidden(['password', 'api_token']);

        return response()->json([
            'driver' => $safe, 
            'token' => $token, 
            'message' => 'Login successful'
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $driver = Driver::where('api_token', hash('sha256', $token))->first();
            if ($driver) {
                $driver->api_token = null;
                $driver->save();
            }
        }

        return response()->json(['message' => 'Logout successful']);
    }
}