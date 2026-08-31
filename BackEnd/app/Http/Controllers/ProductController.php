<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Product;
use App\Services\ProductImageUploadService;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    use AdminAuthTrait;

    public function __construct(private readonly ProductImageUploadService $imageUploadService)
    {
    }

    private function normalizeProductImage(?string $imageValue): string
    {
        $image = trim((string) ($imageValue ?? ''));

        if ($image === '' || $image === '/oppadrulogo.jpg' || $image === 'oppadrulogo.jpg') {
            return '';
        }

        return $image;
    }

    private function productQuery()
    {
        return Product::orderBy('category', 'asc')->orderBy('name', 'asc');
    }

    public function index()
    {
        try {
            return response()->json($this->productQuery()->get());
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

        return response()->json(['data' => $this->productQuery()->get()]);
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
            return response()->json(['message' => 'The image upload is invalid.', 'errors' => $validator->errors()], 422);
        }

        try {
            $file = $request->file('image');
            if (!$file || !$file->isValid()) {
                return response()->json(['message' => 'Invalid image upload.'], 400);
            }

            $result = $this->imageUploadService->uploadFromRequest($file, (string) $request->input('folder', 'products'));
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Image upload failed. Please try again.',
            ], 500);
        }
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

        return response()->json(['product' => $product, 'message' => 'Product created/updated successfully!'], 201);
    }

    public function show($id)
    {
        try {
            return response()->json(Product::with(['addonGroups.addons'])->findOrFail($id));
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
        return response()->json(['product' => $product, 'message' => 'Product updated successfully!']);
    }

    public function destroy(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        Product::findOrFail($id)->delete();
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

        return response()->json(['product' => $product, 'message' => 'Product availability toggled!']);
    }

    public function getAvailable()
    {
        try {
            return response()->json($this->productQuery()->get());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getByCategory($category)
    {
        try {
            return response()->json(Product::where('category', $category)->orderBy('name', 'asc')->get());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}