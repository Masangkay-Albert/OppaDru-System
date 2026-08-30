<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->email))]);

        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => [
                'required', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->where(fn ($query) => $query->whereRaw('LOWER(email) = ?', [$request->email])),
            ],
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'email_verified_at' => null,
        ]);

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::error('Registration email could not be sent.', [
                'user_id' => $user->id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'We could not send the verification email. Please try again later.',
                'debug_error' => $exception->getMessage(), // TEMPORARY - remove once fixed
                'debug_class' => get_class($exception),     // TEMPORARY - remove once fixed
            ], 503);
        }

        return response()->json([
            'user' => $user->makeHidden(['password', 'api_token']),
            'message' => 'Registration successful. Please verify your email address before logging in.',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->email))]);
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$request->email])->first();

        if (!$user) {
            return response()->json([
                'message' => 'This email is not registered. Please register first.',
            ], 404);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password.'
            ], 401);
        }

        if (!$user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before logging in.',
            ], 403);
        }

        $token = Str::random(60);
        $user->api_token = hash('sha256', $token);
        $user->save();

        return response()->json([
            'user' => $user->makeHidden(['password', 'api_token']),
            'token' => $token,
            'message' => 'Login successful!'
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            $user->api_token = null;
            $user->save();
        }

        return response()->json(['message' => 'Logout successful!']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user->update($request->only(['full_name', 'phone']));

        return response()->json([
            'user' => $user,
            'message' => 'Profile updated successfully!'
        ]);
    }

    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->user()->email)->first();

        if (!$user || !Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect!'
            ], 401);
        }

        $user->password = Hash::make($request->new_password);
        $user->save();

        return response()->json([
            'message' => 'Password changed successfully!'
        ]);
    }
}