<?php

namespace App\Http\Middleware;

use App\Models\Employee;
use Closure;
use Illuminate\Http\Request;

class EnsureEmployeeAccess
{
    public function handle(Request $request, Closure $next, string ...$allowedPositions)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['message' => 'Unauthenticated employee.'], 401);
        }

        $employee = Employee::where('api_token', hash('sha256', $token))->first();
        if (!$employee) {
            return response()->json(['message' => 'Invalid employee token.'], 401);
        }

        if (!$employee->is_active) {
            return response()->json(['message' => 'Employee account is inactive.'], 403);
        }

        $position = str_replace(' ', '_', strtolower(trim((string) $employee->position)));
        if ($allowedPositions !== [] && !in_array($position, $allowedPositions, true)) {
            return response()->json(['message' => 'This role is not allowed to access this resource.'], 403);
        }

        if ($employee->franchise_id && (!$employee->franchise || $employee->franchise->status !== 'active')) {
            return response()->json(['message' => 'This branch is not currently active.'], 403);
        }

        $request->setUserResolver(fn () => $employee);

        $requestedFranchise = $request->route('franchise_id')
            ?? $request->input('franchise_id')
            ?? $request->query('franchise_id');
        if ($requestedFranchise !== null && (string) $requestedFranchise !== (string) $employee->franchise_id) {
            return response()->json(['message' => 'You do not have access to this branch.'], 403);
        }

        return $next($request);
    }
}
