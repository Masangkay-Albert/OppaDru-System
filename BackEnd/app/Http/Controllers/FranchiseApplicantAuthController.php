<?php

namespace App\Http\Controllers;

use App\Models\FranchiseApplicant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FranchiseApplicantAuthController extends Controller
{
    public function register(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $validator = Validator::make($request->all(), [
            'full_name' => [
                'required',
                'string',
                'min:'.config('input_limits.person_name.min'),
                'max:'.config('input_limits.person_name.max'),
                'regex:'.config('input_limits.person_name.pattern'),
            ],
            'email' => ['required', 'email', 'max:'.config('input_limits.email'), 'unique:franchise_applicants,email'],
            'phone' => ['nullable', 'string', 'max:11', 'regex:/^09\d{9}$/'],
            'password' => ['required', 'string', 'min:'.config('input_limits.password.min'), 'max:'.config('input_limits.password.max'), 'confirmed'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $applicant = FranchiseApplicant::create([
            'full_name' => trim($request->input('full_name')),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'password' => $request->input('password'),
        ]);

        try {
            $applicant->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::error('Franchise applicant verification email could not be sent.', [
                'franchise_applicant_id' => $applicant->id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
            ]);

            $applicant->delete();

            return response()->json([
                'message' => 'We could not send the verification email. Please try registering again later.',
            ], 503);
        }

        return response()->json([
            'applicant' => $applicant->makeHidden(['password', 'api_token']),
            'message' => 'Account created. Please verify your email address before signing in.',
        ], 201);
    }

    public function login(Request $request)
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:'.config('input_limits.email')],
            'password' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $applicant = FranchiseApplicant::whereRaw('LOWER(email) = ?', [$request->input('email')])->first();
        if (! $applicant || ! Hash::check($request->input('password'), $applicant->password)) {
            return response()->json(['message' => 'Invalid email or password.'], 401);
        }
        if (! $applicant->hasVerifiedEmail()) {
            return response()->json(['message' => 'Please verify your email address before logging in.'], 403);
        }

        $token = Str::random(60);
        $applicant->api_token = hash('sha256', $token);
        $applicant->save();

        return response()->json([
            'applicant' => $applicant->makeHidden(['password', 'api_token']),
            'token' => $token,
            'message' => 'Franchise applicant login successful.',
        ]);
    }

    public function logout(Request $request)
    {
        $applicant = $request->user();
        $applicant->api_token = null;
        $applicant->save();

        return response()->json(['message' => 'Logout successful.']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'applicant' => $request->user()->makeHidden(['password', 'api_token']),
        ]);
    }

    public function resendVerification(Request $request)
    {
        $validated = $request->validate(['email' => ['required', 'email', 'max:'.config('input_limits.email')]]);
        $applicant = FranchiseApplicant::whereRaw('LOWER(email) = ?', [strtolower(trim($validated['email']))])->first();
        if (! $applicant) {
            return response()->json(['message' => 'This email is not registered as a franchise applicant.'], 404);
        }
        if ($applicant->hasVerifiedEmail()) {
            return response()->json(['message' => 'This email address is already verified.'], 409);
        }

        try {
            $applicant->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::error('Franchise applicant verification email could not be resent.', [
                'franchise_applicant_id' => $applicant->id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'We could not send the verification email. Please try again later.'], 503);
        }

        return response()->json(['message' => 'Verification email accepted for delivery.']);
    }
}
