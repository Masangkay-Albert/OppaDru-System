<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class EmployeeAuthController extends Controller
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

        $employee = Employee::with('franchise')
            ->where('email', strtolower(trim((string) $request->email)))
            ->first();

        if (!$employee || !Hash::check($request->password, $employee->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }
        if (!$employee->is_active) {
            return response()->json(['message' => 'Employee account is inactive. Please contact the branch manager.'], 403);
        }
        if ($employee->franchise_id && (!$employee->franchise || !$employee->franchise->isOperationallyActive())) {
            return response()->json(['message' => 'This branch is not currently active.'], 403);
        }
    
        $token = Str::random(60);
        $employee->api_token = hash('sha256', $token);
        $employee->save();

        $safe = $employee->makeHidden(['password', 'api_token']);

        return response()->json([
            'success' => true,
            'employee' => $safe, 
            'token' => $token, 
            'position' => strtolower($employee->position), 
            'message' => 'Login successful'
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $employee = Employee::where('api_token', hash('sha256', $token))->first();
            if ($employee) {
                $employee->api_token = null;
                $employee->save();
            }
        }

        return response()->json(['message' => 'Logout successful.']);
    }
}