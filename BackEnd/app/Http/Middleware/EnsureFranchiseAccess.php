<?php

namespace App\Http\Middleware;

use App\Models\FranchiseUser;
use Closure;
use Illuminate\Http\Request;

class EnsureFranchiseAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $franchiseUser = FranchiseUser::where('api_token', hash('sha256', $token))->first();
        if (!$franchiseUser) {
            return response()->json(['message' => 'Invalid franchise token'], 401);
        }

        if (!$franchiseUser->is_active) {
            return response()->json(['message' => 'Franchise account inactive'], 403);
        }

        $request->setUserResolver(fn () => $franchiseUser);

        $requestedFranchise = $request->route('franchise_id') ?? $request->input('franchise_id') ?? $request->query('franchise_id');
        if ($requestedFranchise !== null && (string) $requestedFranchise !== (string) $franchiseUser->franchise_id) {
            return response()->json(['message' => 'You do not have access to this franchise'], 403);
        }

        return $next($request);
    }
}
