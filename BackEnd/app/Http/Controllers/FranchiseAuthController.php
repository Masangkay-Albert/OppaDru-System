<?php

namespace App\Http\Controllers;

use App\Models\FranchiseApplicant;
use App\Models\FranchiseApplication;
use App\Models\FranchiseUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class FranchiseAuthController extends Controller
{
    private const SESSION_COOKIE = 'oppa_franchise_session';

    public function login(Request $request)
    {
        $email = strtolower(trim((string) $request->input('email')));
        $request->merge(['email' => $email]);
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            $this->recordLoginAttempt($request, $email, null, null, 'blocked', 'invalid_request');

            return response()->json(['message' => 'Incorrect email or password.'], 422);
        }

        $franchiseUser = FranchiseUser::with(['franchise', 'franchiseAccount'])
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $franchiseUser) {
            $applicant = FranchiseApplicant::whereRaw('LOWER(email) = ?', [$email])->first();
            if (! $applicant || ! Hash::check($request->input('password'), $applicant->password) || ! $applicant->hasVerifiedEmail()) {
                $this->recordLoginAttempt($request, $email, $applicant?->id, null, 'blocked', 'invalid_credentials');

                return response()->json(['message' => 'Incorrect email or password.'], 401);
            }

            $application = $applicant->applications()
                ->orderByRaw("CASE status WHEN 'approved' THEN 0 WHEN 'active' THEN 0 WHEN 'rejected' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END")
                ->latest()
                ->first();
            $this->recordLoginAttempt(
                $request,
                $email,
                $applicant->id,
                null,
                'blocked',
                $application?->status === 'rejected' ? 'rejected' : ($application?->status === 'on_hold' ? 'on_hold' : 'not_eligible'),
            );
            Log::notice('Franchise applicant login blocked because no dashboard user is linked.', [
                'franchise_applicant_id' => $applicant->id,
                'application_id' => $application?->id,
                'application_status' => $application?->status,
                'franchise_found' => false,
                'role' => null,
            ]);

            return response()->json([
                'message' => $this->eligibilityMessage($application),
                'status' => $application?->status,
                'reference_number' => $application?->reference_number,
            ], 403);
        }

        if (! Hash::check($request->input('password'), $franchiseUser->password)) {
            $this->recordLoginAttempt($request, $email, null, $franchiseUser->id, 'blocked', 'invalid_credentials');

            return response()->json(['message' => 'Incorrect email or password.'], 401);
        }

        if (! $franchiseUser->is_active) {
            $this->recordLoginAttempt($request, $email, null, $franchiseUser->id, 'blocked', 'inactive_user');
            Log::notice('Franchise login blocked because the franchise user is inactive.', [
                'franchise_user_id' => $franchiseUser->id,
                'franchise_id' => $franchiseUser->franchise_id,
                'franchise_status' => $franchiseUser->franchise?->status,
                'role' => 'franchisee',
            ]);

            return response()->json(['message' => 'Your franchise access has been deactivated. Contact support.'], 403);
        }

        if (! $franchiseUser->franchise || ! $franchiseUser->franchise->isOperationallyActive()) {
            $this->recordLoginAttempt($request, $email, null, $franchiseUser->id, 'blocked', 'inactive_franchise');
            Log::notice('Franchise login blocked because the franchise record is inactive or missing.', [
                'franchise_user_id' => $franchiseUser->id,
                'franchise_id' => $franchiseUser->franchise_id,
                'franchise_status' => $franchiseUser->franchise?->status,
                'franchise_found' => (bool) $franchiseUser->franchise,
                'role' => 'franchisee',
            ]);

            return response()->json(['message' => 'Your franchise access has been deactivated. Contact support.'], 403);
        }

        $token = Str::random(64);
        $franchiseUser->api_token = hash('sha256', $token);
        $franchiseUser->api_token_expires_at = now()->addHours(8);
        $franchiseUser->save();
        $this->recordLoginAttempt($request, $email, null, $franchiseUser->id, 'success', 'login');

        return response()->json([
            'franchise_user' => $franchiseUser->load('franchise')->makeHidden(['password', 'api_token', 'api_token_expires_at']),
            'token' => $token,
            'expires_at' => $franchiseUser->api_token_expires_at->toIso8601String(),
            'message' => 'Franchise login successful.',
        ])->cookie($this->sessionCookie($request, $token));
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken() ?: $request->cookie(self::SESSION_COOKIE);
        if ($token) {
            FranchiseUser::where('api_token', hash('sha256', $token))
                ->update(['api_token' => null, 'api_token_expires_at' => null]);
        }

        return response()->json(['message' => 'Logout successful.'])
            ->withCookie(cookie()->forget(self::SESSION_COOKIE));
    }

    public function me(Request $request)
    {
        $franchiseUser = $request->user();

        if (! $franchiseUser) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'franchise_user' => $franchiseUser->load(['franchise', 'franchiseAccount'])
                ->makeHidden(['password', 'api_token', 'api_token_expires_at']),
        ]);
    }

    private function eligibilityMessage(?FranchiseApplication $application): string
    {
        if (! $application) {
            return 'Your application is still under review.';
        }
        if ($application->status === 'rejected') {
            return 'Your application was not approved. Contact franchise support for assistance.';
        }
        if ($application->status === 'on_hold') {
            return 'Your application is on hold. Contact franchise support for assistance.';
        }
        if ($application->status === 'approved') {
            return 'Your franchise is approved, but its dashboard access is not active. Contact franchise support.';
        }

        return 'Your application is still being reviewed. Current stage: '.FranchiseApplication::defaultInstructionsFor($application->status);
    }

    private function recordLoginAttempt(
        Request $request,
        string $email,
        ?string $applicantId,
        ?string $franchiseUserId,
        string $outcome,
        string $reason,
    ): void {
        DB::table('franchise_auth_events')->insert([
            'franchise_applicant_id' => $applicantId,
            'franchise_user_id' => $franchiseUserId,
            'email_fingerprint' => hash('sha256', $email),
            'outcome' => $outcome,
            'reason' => $reason,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
            'created_at' => now(),
        ]);
    }

    private function sessionCookie(Request $request, string $token)
    {
        return cookie(
            self::SESSION_COOKIE,
            $token,
            480,
            '/',
            null,
            $request->isSecure(),
            true,
            false,
            'lax',
        );
    }
}
