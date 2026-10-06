<?php

namespace App\Support;

use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use RuntimeException;

final class DatabaseImage
{
    public static function fromUploadedFile(UploadedFile $file): string
    {
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false) {
            throw new RuntimeException('Unable to read the uploaded proof image.');
        }

        $mimeType = $file->getMimeType();
        if (! $mimeType || ! str_starts_with($mimeType, 'image/')) {
            throw new RuntimeException('The uploaded proof is not a supported image.');
        }

        return 'data:'.$mimeType.';base64,'.base64_encode($contents);
    }

    public static function response(string $dataUri): Response
    {
        $parts = explode(',', $dataUri, 2);
        $metadata = $parts[0] ?? '';
        $mimeType = str_starts_with($metadata, 'data:') && str_ends_with($metadata, ';base64')
            ? substr($metadata, 5, -7)
            : '';

        if (count($parts) !== 2 || ! preg_match('/\Aimage\/[a-z0-9.+-]+\z/i', $mimeType)) {
            abort(404, 'Proof image not found.');
        }

        $contents = base64_decode($parts[1], true);
        if ($contents === false) {
            abort(404, 'Proof image not found.');
        }

        return response($contents, 200, [
            'Content-Type' => strtolower($mimeType),
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
