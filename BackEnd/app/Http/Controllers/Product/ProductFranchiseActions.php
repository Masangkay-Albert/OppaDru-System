<?php

namespace App\Http\Controllers\Product;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

trait ProductFranchiseActions
{
    public function franchiseIndex(Request $request)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        return response()->json($this->franchiseProductQuery($request)->get());
    }

    public function franchiseStore(Request $request)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $payload = $request->all();
        $payload['franchise_id'] = $franchiseUser->franchise_id;
        $payload['image'] = $this->normalizeProductImage($request->input('image'));

        $validator = Validator::make($payload, [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0.01',
            'category' => 'required|string',
            'image' => 'nullable|string',
            'is_available' => 'sometimes|boolean',
            'franchise_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $product = Product::create([
            'id' => 'PROD-'.Str::random(8).'-'.strtoupper(Str::random(4)),
            'franchise_id' => $franchiseUser->franchise_id,
            'name' => $request->name,
            'description' => $request->description,
            'price' => $request->price,
            'category' => $request->category,
            'image' => $payload['image'],
            'is_available' => $request->boolean('is_available', true),
        ]);

        return response()->json(['product' => $product, 'message' => 'Franchise product created successfully!'], 201);
    }

    public function franchiseUpdate(Request $request, $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where('franchise_id', $franchiseUser->franchise_id)->findOrFail($id);
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

        return response()->json(['product' => $product, 'message' => 'Franchise product updated successfully!']);
    }

    public function franchiseDestroy(Request $request, $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where('franchise_id', $franchiseUser->franchise_id)->findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Franchise product deleted successfully!']);
    }

    public function franchiseToggleAvailability(Request $request, $id)
    {
        $franchiseUser = $this->franchiseUser($request);
        if (! $franchiseUser) {
            return response()->json(['message' => 'Franchise access required'], 403);
        }

        $product = Product::where('franchise_id', $franchiseUser->franchise_id)->findOrFail($id);
        $product->is_available = ! $product->is_available;
        $product->save();

        return response()->json(['product' => $product, 'message' => 'Franchise product availability toggled!']);
    }
}
