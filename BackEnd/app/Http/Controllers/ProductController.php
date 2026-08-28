<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    private function checkAdminAuth(Request $request)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return false;
        }

        return Admin::where('api_token', hash('sha256', $token))->exists();
    }

    public function index()
    {
        try {
            $products = Product::orderBy('category', 'asc')
                ->orderBy('name', 'asc')
                ->get();
            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function count(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json(['count' => Product::count()]);
    }

    public function getAllForAdmin(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $products = Product::orderBy('category', 'asc')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json(['data' => $products]);
    }

    private function getSupabaseStorageKey(): ?string
    {
        foreach (['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'SUPABASE_KEY', 'SUPABASE_ANON_KEY'] as $envKey) {
            $value = env($envKey);
            if (!empty($value)) {
                return (string) $value;
            }
        }

        return null;
    }

    private function ensureBucketExists(string $supabaseUrl, string $supabaseKey, string $bucketName): bool
    {
        $bucketCheck = Http::withHeaders([
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Content-Type' => 'application/json',
        ])->withOptions([
            'verify' => false,
        ])->get($supabaseUrl . '/storage/v1/bucket/' . rawurlencode($bucketName));

        if ($bucketCheck->successful()) {
            return true;
        }

        $create = Http::withHeaders([
            'Authorization' => 'Bearer ' . $supabaseKey,
            'Content-Type' => 'application/json',
        ])->withOptions([
            'verify' => false,
        ])->post($supabaseUrl . '/storage/v1/bucket', [
            'name' => $bucketName,
            'public' => true,
        ]);

        return $create->successful();
    }

    public function uploadImage(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|file|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'folder' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $file = $request->file('image');
            if (!$file || !$file->isValid()) {
                return response()->json(['error' => 'Invalid image upload'], 400);
            }

            $folder = trim((string) $request->input('folder', 'products'), '/');
            $folder = $folder !== '' ? $folder : 'products';
            $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $filePath = $folder . '/' . $fileName;

            $supabaseUrl = env('SUPABASE_URL');
            $supabaseKey = $this->getSupabaseStorageKey();

            if (!$supabaseUrl || !$supabaseKey) {
                $base64 = base64_encode(file_get_contents($file->getRealPath()));
                $mimeType = $file->getMimeType();
                $dataUrl = 'data:' . $mimeType . ';base64,' . $base64;
                
                return response()->json([
                    'success' => true,
                    'url' => $dataUrl,
                    'path' => $filePath,
                ]);
            }

            $bucketReady = $this->ensureBucketExists($supabaseUrl, $supabaseKey, $folder);
            if (!$bucketReady) {
                $base64 = base64_encode(file_get_contents($file->getRealPath()));
                $mimeType = $file->getMimeType();
                $dataUrl = 'data:' . $mimeType . ';base64,' . $base64;
                
                return response()->json([
                    'success' => true,
                    'url' => $dataUrl,
                    'path' => $filePath,
                ]);
            }

            $content = file_get_contents($file->getRealPath());
            if ($content === false) {
                return response()->json(['error' => 'Could not read uploaded file'], 500);
            }

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $supabaseKey,
                'Content-Type' => $file->getMimeType(),
                'x-upsert' => 'true',
            ])->withOptions([
                'verify' => false,
            ])->withBody($content, $file->getMimeType())
                ->put($supabaseUrl . '/storage/v1/object/' . rawurlencode($folder) . '/' . rawurlencode($fileName));

            if (!$response->successful()) {
                $base64 = base64_encode($content);
                $mimeType = $file->getMimeType();
                $dataUrl = 'data:' . $mimeType . ';base64,' . $base64;
                
                return response()->json([
                    'success' => true,
                    'url' => $dataUrl,
                    'path' => $filePath,
                ]);
            }

            $publicUrl = rtrim($supabaseUrl, '/') . '/storage/v1/object/public/' . $folder . '/' . $fileName;

            return response()->json([
                'success' => true,
                'url' => $publicUrl,
                'path' => $filePath,
            ]);
        } catch (\Exception $e) {
            try {
                $file = $request->file('image');
                if ($file && $file->isValid()) {
                    $base64 = base64_encode(file_get_contents($file->getRealPath()));
                    $mimeType = $file->getMimeType();
                    $dataUrl = 'data:' . $mimeType . ';base64,' . $base64;
                    
                    return response()->json([
                        'success' => true,
                        'url' => $dataUrl,
                        'path' => $filePath ?? null,
                    ]);
                }
            } catch (\Exception $inner) {
                // Fall through
            }
            
            return response()->json([
                'success' => true,
                'url' => '/oppadrulogo.jpg',
                'path' => $filePath ?? null,
                'warning' => 'Image upload failed; default image used.',
            ]);
        }
    }

    private function normalizeProductImage(?string $imageValue): string
    {
        $image = trim((string) ($imageValue ?? ''));

        return $image !== '' ? $image : '/oppadrulogo.jpg';
    }

    public function store(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = $request->all();
        $payload['image'] = $this->normalizeProductImage($request->input('image'));

        $validator = Validator::make($payload, [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0.01',
            'category' => 'required|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $name = trim((string) $request->name);
        $normalizedName = strtolower(preg_replace('/\s+/', ' ', $name));

        $product = Product::whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])->first();

        if ($product) {
            $product->update($payload);
        } else {
            $payload['id'] = 'PROD-' . Str::random(8) . '-' . strtoupper(Str::random(4));
            $product = Product::create($payload);
        }

        return response()->json([
            'product' => $product,
            'message' => 'Product created/updated successfully!',
        ], 201);
    }

    public function show($id)
    {
        try {
            $product = Product::findOrFail($id);
            return response()->json($product);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Product not found'], 404);
        }
    }

    public function update(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::findOrFail($id);
        $payload = $request->all();

        if ($request->has('image')) {
            $payload['image'] = $this->normalizeProductImage($request->input('image'));
        }

        $validator = Validator::make($payload, [
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0.01',
            'category' => 'sometimes|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $product->update($payload);

        return response()->json([
            'product' => $product,
            'message' => 'Product updated successfully!',
        ]);
    }

    public function destroy(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully!']);
    }

    public function toggleAvailability(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $product = Product::findOrFail($id);
        $product->is_available = !$product->is_available;
        $product->save();

        return response()->json([
            'product' => $product,
            'message' => 'Product availability toggled!',
        ]);
    }

    public function getAvailable()
    {
        try {
            $products = Product::orderBy('category', 'asc')
                ->orderBy('name', 'asc')
                ->get();

            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getByCategory($category)
    {
        try {
            $products = Product::where('category', $category)
                ->orderBy('name', 'asc')
                ->get();
            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}