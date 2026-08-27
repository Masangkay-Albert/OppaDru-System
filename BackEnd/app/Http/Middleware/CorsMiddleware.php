<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->headers->get('Origin');

        $allowedOrigins = config('cors.allowed_origins', []);
        $allowedPatterns = config('cors.allowed_origins_patterns', []);

        $isAllowed = false;
        if ($origin) {
            if (in_array($origin, $allowedOrigins, true)) {
                $isAllowed = true;
            } else {
                foreach ($allowedPatterns as $pattern) {
                    if (preg_match($pattern, $origin)) {
                        $isAllowed = true;
                        break;
                    }
                }
            }
        }

        $headers = [
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers' => $request->headers->get('Access-Control-Request-Headers', 'Content-Type, Authorization, X-Requested-With, X-XSRF-TOKEN'),
            'Access-Control-Allow-Credentials' => 'true',
        ];

        if ($isAllowed) {
            $headers['Access-Control-Allow-Origin'] = $origin;
        }

        if ($request->isMethod('OPTIONS')) {
            return response('', 204, $headers);
        }

        $response = $next($request);

        if ($isAllowed) {
            foreach ($headers as $key => $value) {
                $response->headers->set($key, $value);
            }
        }

        return $response;
    }
}