<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function index(Request $request)
    {
        // simple token check: require Authorization: Bearer <token>
        $auth = $request->bearerToken();
        if (!$auth || !Admin::where('api_token', hash('sha256', $auth))->first()) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $admins = Admin::select('id', 'full_name', 'email', 'created_at', 'updated_at')->get();
        return response()->json(['data' => $admins]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admin,email',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $token = Str::random(60);

        $admin = Admin::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'api_token' => hash('sha256', $token),
        ]);

        return response()->json(['admin' => $admin, 'token' => $token], 201);
    }

    public function count(Request $request)
    {
        $auth = $request->bearerToken();
        if (!$auth || !Admin::where('api_token', hash('sha256', $auth))->first()) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $count = Admin::count();
        return response()->json(['count' => $count]);
    }
}
