<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index()
    {
        try {
            $products = Product::all();
            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|max:5120',
            'folder' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $file = $request->file('image');
            $folder = $request->folder ?? 'products';
            $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $filePath = $folder . '/' . $fileName;

            $fileContent = file_get_contents($file->getRealPath());

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . env('SUPABASE_KEY'),
                'Content-Type' => $file->getMimeType(),
            ])->withBody(
                $fileContent,
                $file->getMimeType()
            )->put(env('SUPABASE_URL') . '/storage/v1/object/products/' . $filePath);

            if (!$response->successful()) {
                return response()->json([
                    'error' => 'Failed to upload image: ' . $response->body()
                ], 500);
            }

            $imageUrl = env('SUPABASE_URL') . '/storage/v1/object/public/products/' . $filePath;

            return response()->json([
                'success' => true,
                'url' => $imageUrl,
                'path' => $filePath,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Image upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'category' => 'required|string',
            'image' => 'required|string',
            'is_available' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Normalize name for duplication prevention (case-insensitive, trimmed)
        $name = trim($request->name);
        $normName = strtolower(preg_replace('/\s+/', ' ', $name));

        // Find existing product by normalized name (case-insensitive, trimmed)
        $product = Product::whereRaw('LOWER(TRIM(name)) = ?', [$normName])->first();

        if ($product) {
            $product->update($request->all());
        } else {
            $product = Product::create($request->all());
        }

        return response()->json([
            'product' => $product,
            'message' => 'Product created/updated successfully!'
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
        $product = Product::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0',
            'category' => 'sometimes|string',
            'image' => 'sometimes|string',
            'is_available' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $product->update($request->all());

        return response()->json([
            'product' => $product,
            'message' => 'Product updated successfully!'
        ]);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully!']);
    }

    public function toggleAvailability($id)
    {
        $product = Product::findOrFail($id);
        $product->is_available = !$product->is_available;
        $product->save();

        return response()->json([
            'product' => $product,
            'message' => 'Product availability toggled!'
        ]);
    }

    public function getAvailable()
    {
        try {
            $products = Product::where('is_available', true)->get();
            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getByCategory($category)
    {
        try {
            $products = Product::where('category', $category)->get();
            return response()->json($products);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}