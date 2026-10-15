<?php

namespace App\Traits;

use App\Models\Admin;
use Illuminate\Http\Request;

trait AdminAuthTrait
{
    protected function checkAdminAuth(Request $request): bool
    {
        $token = $request->bearerToken();
        if (!$token) {
            return false;
        }

        $hashedToken = hash('sha256', $token);

        return Admin::query()
            ->where(function ($query) use ($token, $hashedToken) {
                $query->where('api_token', $hashedToken)
                    ->orWhere('api_token', $token);
            })
            ->exists();
    }
}
