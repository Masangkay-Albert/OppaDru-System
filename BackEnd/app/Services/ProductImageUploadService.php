<?php

namespace App\Services;

use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

class ProductImageUploadService
{
    public function getSupabaseStorageKey(): ?string
    {
        foreach (['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'SUPABASE_KEY', 'SUPABASE_ANON_KEY'] as $envKey) {
            $value = env($envKey);
            if (!empty($value)) {
                return (string) $value;
            }
        }

        return null;
    }

    public function ensureBucketExists(string $supabaseUrl, string $supabaseKey, string $bucketName): bool
    {
        $bucketCheck = Http::withHeaders([
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Content-Type' => 'application/json',
        ])->withOptions(['verify' => false])->get($supabaseUrl . '/storage/v1/bucket/' . rawurlencode($bucketName));

        if ($bucketCheck->successful()) {
            return true;
        }

        $create = Http::withHeaders([
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Content-Type' => 'application/json',
        ])->withOptions(['verify' => false])->post($supabaseUrl . '/storage/v1/bucket', [
            'name' => $bucketName,
            'public' => true,
        ]);

        return $create->successful();
    }

    public function uploadFromRequest(\Illuminate\Http\UploadedFile $file, string $folder): array
    {
        $folder = trim($folder, '/');
        $folder = $folder !== '' ? $folder : 'products';
        $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
        $filePath = $folder . '/' . $fileName;

        $supabaseUrl = env('SUPABASE_URL');
        $supabaseKey = $this->getSupabaseStorageKey();

        if (!$supabaseUrl || !$supabaseKey) {
            return ['success' => true, 'url' => '/oppadrulogo.jpg', 'path' => $filePath, 'warning' => 'Supabase storage not configured; default image used.'];
        }

        $bucketReady = $this->ensureBucketExists($supabaseUrl, $supabaseKey, $folder);
        if (!$bucketReady) {
            return ['success' => true, 'url' => '/oppadrulogo.jpg', 'path' => $filePath, 'warning' => 'Storage bucket not ready; default image used.'];
        }

        $content = file_get_contents($file->getRealPath());
        if ($content === false) {
            return ['success' => true, 'url' => '/oppadrulogo.jpg', 'path' => $filePath, 'warning' => 'Could not read uploaded file.'];
        }

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Content-Type' => $file->getMimeType(),
            'x-upsert' => 'true',
        ])->withOptions(['verify' => false])->withBody($content, $file->getMimeType())
            ->put($supabaseUrl . '/storage/v1/object/' . rawurlencode($folder) . '/' . rawurlencode($fileName));

        if (!$response->successful()) {
            return ['success' => true, 'url' => '/oppadrulogo.jpg', 'path' => $filePath, 'warning' => 'Image upload failed; default image used.'];
        }

        return [
            'success' => true,
            'url' => rtrim($supabaseUrl, '/') . '/storage/v1/object/public/' . $folder . '/' . $fileName,
            'path' => $filePath,
        ];
    }
}
