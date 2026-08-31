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
            return ['success' => true, 'url' => $this->base64Fallback($file), 'path' => $filePath];
        }

        $bucketReady = $this->ensureBucketExists($supabaseUrl, $supabaseKey, $folder);
        if (!$bucketReady) {
            return ['success' => true, 'url' => $this->base64Fallback($file), 'path' => $filePath];
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
            return ['success' => true, 'url' => $this->base64Fallback($file), 'path' => $filePath];
        }

        return [
            'success' => true,
            'url' => rtrim($supabaseUrl, '/') . '/storage/v1/object/public/' . $folder . '/' . $fileName,
            'path' => $filePath,
        ];
    }

    public function base64Fallback(\Illuminate\Http\UploadedFile $file): string
    {
        $base64 = base64_encode(file_get_contents($file->getRealPath()));
        return 'data:' . $file->getMimeType() . ';base64,' . $base64;
    }
}
