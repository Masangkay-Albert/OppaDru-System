<?php

namespace App\Traits;

use App\Models\Admin;
use Illuminate\Http\Request;

trait AdminAuthTrait
{
    protected function checkAdminAuth(Request $request): bool
    {
        $token = $request->bearerToken();
        return $token && Admin::where('api_token', hash('sha256', $token))->exists();
    }
}
