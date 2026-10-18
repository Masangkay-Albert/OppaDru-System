<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureFranchiseRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->user();
        $role = strtolower((string) ($user?->role ?: 'owner'));
        $allowed = collect($roles)->contains(fn (string $allowedRole) => str_contains($role, strtolower($allowedRole)));

        return $allowed
            ? $next($request)
            : response()->json(['message' => 'You do not have access to this branch feature.'], 403);
    }
}
