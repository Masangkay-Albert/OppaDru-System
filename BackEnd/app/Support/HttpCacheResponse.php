<?php

namespace App\Support;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

trait HttpCacheResponse
{
    /**
     * Return a JSON response with ETag and Cache-Control headers,
     * supporting 304 Not Modified if the client cache matches.
     */
    protected function cachedJsonResponse(Request $request, mixed $data, int $maxAgeSeconds = 300): Response
    {
        $json = is_string($data) ? $data : json_encode($data);
        $etag = '"' . md5($json) . '"';

        if ($request->header('If-None-Match') === $etag) {
            return response('', 304, [
                'ETag' => $etag,
                'Cache-Control' => "public, max-age={$maxAgeSeconds}, must-revalidate",
            ]);
        }

        return response($json, 200, [
            'Content-Type' => 'application/json',
            'ETag' => $etag,
            'Cache-Control' => "public, max-age={$maxAgeSeconds}, must-revalidate",
        ]);
    }
}

