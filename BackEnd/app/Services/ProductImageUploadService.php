<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageUploadService
{
    public function uploadFromRequest(UploadedFile $file, string $folder): array
    {
        $folder = trim((string) $folder, '/');
        $folder = $folder !== '' ? $folder : 'products';

        $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
        $relativePath = trim($folder, '/') . '/' . $fileName;

        $storedPath = Storage::disk('public')->putFileAs($folder, $file, $fileName);
        if ($storedPath === false) {
            return ['success' => true, 'url' => '/oppadrulogo.jpg', 'path' => $relativePath, 'warning' => 'Image upload failed; default image used.'];
        }

        $publicUrl = rtrim(config('app.url', 'https://oppadru-system-1.onrender.com'), '/') . '/storage/' . ltrim($storedPath, '/');

        return [
            'success' => true,
            'url' => $publicUrl,
            'path' => $storedPath,
        ];
    }
}
