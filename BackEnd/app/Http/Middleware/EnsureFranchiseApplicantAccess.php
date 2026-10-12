<?php

namespace App\Http\Middleware;

use App\Models\FranchiseApplicant;
use Closure;
use Illuminate\Http\Request;

class EnsureFranchiseApplicantAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $applicant = FranchiseApplicant::where('api_token', hash('sha256', $token))->first();
        if (! $applicant) {
            return response()->json(['message' => 'Invalid franchise applicant credentials'], 401);
        }

        if (! $applicant->hasVerifiedEmail()) {
            return response()->json(['message' => 'Please verify your email address before accessing your franchise applications.'], 403);
        }

        $request->setUserResolver(fn () => $applicant);

        return $next($request);
    }
}
