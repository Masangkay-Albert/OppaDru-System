<?php

namespace App\Http\Controllers;

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AddonController extends Controller
{
    private function checkAdminAuth(Request $request): bool
    {
        $token = $request->bearerToken();
        return $token && \App\Models\Admin::where('api_token', hash('sha256', $token))->exists();
    }

    public function index(Request $request)
    {
        $category = $request->query('category');
        $productId = $request->query('product_id');

        $isAdmin = $this->checkAdminAuth($request);

        $groups = AddonGroup::query()
            ->when(!$isAdmin, fn ($query) => $query->where('is_active', true))
            ->when($productId, function ($query) use ($productId) {
                $query->where(function ($nested) use ($productId) {
                    $nested->whereHas('products', fn ($products) => $products->where('products.id', $productId))
                        ->orWhereJsonContains('applicable_categories', Product::find($productId)?->category);
                });
            })
            ->when(!$productId && $category, fn ($query) => $query->whereJsonContains('applicable_categories', $category))
            ->with(['addons' => fn ($addons) => $isAdmin ? $addons : $addons->where('is_active', true)])
            ->orderBy('sort_order')
            ->get();

        return response()->json($groups);
    }

    public function storeGroup(Request $request)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'selection_type' => 'required|in:single,multiple',
            'supports_quantity' => 'boolean',
            'max_selections' => 'nullable|integer|min:1',
            'applicable_categories' => 'required|array',
            'applicable_categories.*' => 'string',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 422);

        return response()->json(AddonGroup::create($request->all()), 201);
    }

    public function updateGroup(Request $request, AddonGroup $addonGroup)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        $addonGroup->update($request->validate([
            'name' => 'sometimes|string|max:255', 'selection_type' => 'sometimes|in:single,multiple',
            'supports_quantity' => 'sometimes|boolean', 'max_selections' => 'nullable|integer|min:1',
            'applicable_categories' => 'sometimes|array', 'is_active' => 'sometimes|boolean', 'sort_order' => 'sometimes|integer|min:0',
        ]));
        return response()->json($addonGroup);
    }

    public function store(Request $request, AddonGroup $addonGroup)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        return response()->json($addonGroup->addons()->create($request->validate([
            'name' => 'required|string|max:255', 'price' => 'required|numeric|min:0',
            'is_active' => 'boolean', 'sort_order' => 'integer|min:0',
        ])), 201);
    }

    public function update(Request $request, Addon $addon)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        $addon->update($request->validate([
            'name' => 'sometimes|string|max:255', 'price' => 'sometimes|numeric|min:0',
            'is_active' => 'sometimes|boolean', 'sort_order' => 'sometimes|integer|min:0',
        ]));
        return response()->json($addon);
    }

    public function destroy(Request $request, Addon $addon)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $addon->delete();

        return response()->json(['message' => 'Add-on deleted successfully.']);
    }

    public function assignProduct(Request $request, Product $product)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        $groupIds = $request->validate(['addon_group_ids' => 'array', 'addon_group_ids.*' => 'exists:addon_groups,id'])['addon_group_ids'] ?? [];
        $product->addonGroups()->sync($groupIds);
        return response()->json(['message' => 'Add-on groups assigned successfully.']);
    }
}