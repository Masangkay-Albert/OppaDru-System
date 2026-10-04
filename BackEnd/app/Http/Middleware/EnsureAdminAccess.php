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

        $admin = Admin::where('api_token', hash('sha256', $token))->first();
        if (!$admin) {
            return response()->json(['message' => 'Invalid administrator token.'], 401);
        }

        $request->setUserResolver(fn () => $admin);

        return $next($request);
    }
}
