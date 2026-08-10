<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->headers->get('Origin');
        $allowedOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5174',
        ];

        $headers = [
            'Access-Control-Allow-Origin' => in_array($origin, $allowedOrigins, true) ? $origin : 'http://localhost:5173',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers' => $request->headers->get('Access-Control-Request-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN'),
            'Access-Control-Allow-Credentials' => 'true',
        ];

        if ($request->isMethod('OPTIONS')) {
            return response('', 204, $headers);
        }

        $response = $next($request);

        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }

        return $response;
    }
}