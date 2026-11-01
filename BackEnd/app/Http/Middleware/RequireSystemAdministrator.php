<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use Closure;
use Illuminate\Http\Request;

class RequireSystemAdministrator
{
    public function handle(Request $request, Closure $next)
    {
        $admin = $request->user();
        if (! $admin instanceof Admin || $admin->role !== Admin::ROLE_SYSTEM_ADMINISTRATOR) {
            return response()->json(['message' => 'System Administrator access is required.'], 403);
        }

        return $next($request);
    }
}
