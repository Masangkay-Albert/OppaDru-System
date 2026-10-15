<?php

namespace App\Http\Middleware;

use App\Models\FranchiseUser;
use App\Models\FranchiseApplication;
use Closure;
use Illuminate\Http\Request;

class EnsureFranchiseAccess
{
    private const SESSION_COOKIE = 'oppa_franchise_session';

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken() ?: $request->cookie(self::SESSION_COOKIE);
        if (!$token) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $franchiseUser = FranchiseUser::where('api_token', hash('sha256', $token))->first();
        if (!$franchiseUser || ! $franchiseUser->api_token_expires_at || $franchiseUser->api_token_expires_at->isPast()) {
            if ($franchiseUser) {
                $franchiseUser->forceFill(['api_token' => null, 'api_token_expires_at' => null])->save();
            }

            return response()->json(['message' => 'Your franchise session has expired. Sign in again.'], 401)
                ->withCookie(cookie()->forget(self::SESSION_COOKIE));
        }

        if (!$franchiseUser->is_active) {
            return $this->denyAndRevoke($request, $franchiseUser, 'Franchise account inactive.');
        }

        $application = FranchiseApplication::query()
            ->where('franchise_id', $franchiseUser->franchise_id)
            ->latest()
            ->first();
        if ($application && ($application->status !== 'active' || ! $application->activated_at)) {
            $message = match ($application->status) {
                'on_hold' => 'Your application is currently on hold. Please contact support.',
                'rejected' => 'Your application was not approved.',
                'agreement_pending' => 'Please complete your franchise agreement first.',
                'approved', 'approved_for_opening' => 'Your application is approved. Franchise activation is pending.',
                default => 'Your application is still under review.',
            };

            return $this->denyAndRevoke($request, $franchiseUser, $message);
        }

        if (!$franchiseUser->franchise || !$franchiseUser->franchise->isOperationallyActive()) {
            return $this->denyAndRevoke($request, $franchiseUser, 'This branch is not currently active.');
        }

        $request->setUserResolver(fn () => $franchiseUser);

        $requestedFranchise = $request->route('franchise_id') ?? $request->input('franchise_id') ?? $request->query('franchise_id');
        if ($requestedFranchise !== null && (string) $requestedFranchise !== (string) $franchiseUser->franchise_id) {
            return response()->json(['message' => 'You do not have access to this franchise'], 403);
        }

        return $next($request);
    }

    private function denyAndRevoke(Request $request, FranchiseUser $franchiseUser, string $message)
    {
        $franchiseUser->forceFill(['api_token' => null, 'api_token_expires_at' => null])->save();
        $response = response()->json(['message' => $message], 403);

        if ($request->cookie(self::SESSION_COOKIE)) {
            $response->withCookie(cookie()->forget(self::SESSION_COOKIE));
        }

        return $response;
    }
}
