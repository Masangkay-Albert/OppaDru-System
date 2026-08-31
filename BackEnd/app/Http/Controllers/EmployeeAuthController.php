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

        $employee = Employee::where('email', $request->email)->first();

        if (!$employee || !Hash::check($request->password, $employee->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
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
}