<?php

namespace App\Services;

use App\Support\DatabaseImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageUploadService
{
    public function uploadFromRequest(UploadedFile $file, string $folder): array
    {
        $folder = trim((string) $folder, '/');
        $folder = $folder !== '' ? $folder : 'products';

        if ($folder !== 'addons') {
            return [
                'success' => true,
                'url' => DatabaseImage::fromUploadedFile($file),
            ];
        }

        $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();

        $storedPath = Storage::disk('public')->putFileAs($folder, $file, $fileName);
        if ($storedPath === false) {
            throw new \RuntimeException('Unable to store the uploaded image.');
        }

        $publicUrl = rtrim(config('app.url', 'https://oppadru-system-1.onrender.com'), '/') . '/storage/' . ltrim($storedPath, '/');

        return [
            'success' => true,
            'url' => $publicUrl,
            'path' => $storedPath,
        ];
    }
}
