<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use Closure;
use Illuminate\Http\Request;

class EnsureAdminAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['message' => 'Unauthenticated administrator.'], 401);
        }

        $hashedToken = hash('sha256', $token);
        $admin = Admin::query()
            ->where(function ($query) use ($token, $hashedToken) {
                $query->where('api_token', $hashedToken)
                    ->orWhere('api_token', $token);
            })
            ->first();

        if (!$admin) {
            return response()->json(['message' => 'Invalid administrator token.'], 401);
        }

        $request->setUserResolver(fn () => $admin);

        return $next($request);
    }
}
