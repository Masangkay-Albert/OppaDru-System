<?php

namespace App\Http\Controllers;

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\Product;
use App\Support\ProductOptionRules;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AddonController extends Controller
{
    use AdminAuthTrait;

    public function index(Request $request)
    {
        $category = $request->query('category');
        $productId = $request->query('product_id');
        $franchiseUser = $request->user();
        $franchiseId = $franchiseUser instanceof FranchiseUser
            ? $franchiseUser->franchise_id
            : $request->query('franchise_id');
        $product = null;

        $isAdmin = $this->checkAdminAuth($request);
        if ($franchiseId !== null && !Franchise::where('id', $franchiseId)->where('status', 'active')->exists()) {
            return response()->json(['message' => 'The selected branch is not currently active.'], 422);
        }
        if ($productId) {
            $product = Product::find($productId);
            if (!$product || ($product->franchise_id !== null && (string) $product->franchise_id !== (string) $franchiseId)) {
                return response()->json(['message' => 'The product is not available in the selected branch catalog.'], 422);
            }
            if (ProductOptionRules::isFixedPriceBeverage($product)) {
                return response()->json([]);
            }
        } elseif ($category && ProductOptionRules::isFixedPriceBeverageCategory((string) $category)) {
            return response()->json([]);
        }

        $groups = AddonGroup::query()
            ->when(!$isAdmin, fn ($query) => $query->where('is_active', true))
            ->when(!$isAdmin, fn ($query) => $query->where(function ($scope) use ($franchiseId) {
                $scope->whereNull('franchise_id');
                if ($franchiseId !== null) {
                    $scope->orWhere('franchise_id', $franchiseId);
                }
            }))
            ->when($productId, function ($query) use ($productId) {
                $query->where(function ($nested) use ($productId) {
                    $nested->whereHas('products', fn ($products) => $products->where('products.id', $productId))
                        ->orWhereJsonContains('applicable_categories', Product::find($productId)?->category);
                });
            })
            ->when(!$productId && $category, fn ($query) => $query->whereJsonContains('applicable_categories', $category))
            ->with(['addons' => fn ($addons) => $isAdmin ? $addons : $addons
                ->where('is_active', true)
                ->where(function ($scope) use ($franchiseId) {
                    $scope->whereNull('franchise_id');
                    if ($franchiseId !== null) {
                        $scope->orWhere('franchise_id', $franchiseId);
                    }
                })])
            ->orderBy('sort_order')
            ->get();

        return response()->json($groups);
    }

    public function storeGroup(Request $request)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
            ],
            'selection_type' => 'required|in:single,multiple',
            'supports_quantity' => 'boolean',
            'max_selections' => 'nullable|integer|min:1',
            'applicable_categories' => 'required|array',
            'applicable_categories.*' => 'string|not_in:fruity-soda-milk,fresh-lemonade',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);
        if ($validator->fails()) return response()->json(['errors' => $validator->errors()], 422);

        return response()->json(AddonGroup::create($request->all()), 201);
    }

    public function updateGroup(Request $request, AddonGroup $addonGroup)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);
        $requestedName = $request->input('name');
        $nameUnchanged = $request->exists('name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $addonGroup->name);
        $nameRules = ['sometimes', 'string'];
        if ($request->exists('name') && ! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
            ];
        }
        $validated = $request->validate([
            'name' => $nameRules, 'selection_type' => 'sometimes|in:single,multiple',
            'supports_quantity' => 'sometimes|boolean', 'max_selections' => 'nullable|integer|min:1',
            'applicable_categories' => 'sometimes|array', 'applicable_categories.*' => 'string|not_in:fruity-soda-milk,fresh-lemonade',
            'is_active' => 'sometimes|boolean', 'sort_order' => 'sometimes|integer|min:0',
        ]);
        if ($nameUnchanged) {
            $validated['name'] = $addonGroup->getRawOriginal('name');
        }
        $addonGroup->update($validated);
        return response()->json($addonGroup);
    }

    public function store(Request $request, AddonGroup $addonGroup)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                'string',
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
            ],
            'price' => ['required', 'regex:/^\d+(?:\.\d{1,2})?$/', 'numeric', 'min:0.01', 'max:'.config('input_limits.amount')],
            'image' => 'nullable|string',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Price must be a positive number greater than 0.', 'errors' => $validator->errors()], 422);
        }

        return response()->json($addonGroup->addons()->create($validator->validated()), 201);
    }

    public function update(Request $request, Addon $addon)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $requestedName = $request->input('name');
        $nameUnchanged = $request->exists('name')
            && is_string($requestedName)
            && trim($requestedName) === trim((string) $addon->name);
        $requestedPrice = (string) $request->input('price');
        $priceUnchanged = $request->exists('price')
            && preg_match('/^\d+(?:\.\d{1,2})?$/', $requestedPrice) === 1
            && bccomp($requestedPrice, (string) $addon->getRawOriginal('price'), 2) === 0;
        $nameRules = ['sometimes', 'string'];
        if ($request->exists('name') && ! $nameUnchanged) {
            $nameRules = [
                ...$nameRules,
                'min:'.config('input_limits.category_or_supplier_name.min'),
                'max:'.config('input_limits.category_or_supplier_name.max'),
                'regex:'.config('input_limits.business_name.pattern'),
            ];
        }
        $priceRules = ['sometimes', 'numeric'];
        if ($request->exists('price') && ! $priceUnchanged) {
            $priceRules = [...$priceRules, 'regex:/^\d+(?:\.\d{1,2})?$/', 'min:0.01', 'max:'.config('input_limits.amount')];
        }
        $validator = Validator::make($request->all(), [
            'name' => $nameRules,
            'price' => $priceRules,
            'image' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Price must be a positive number greater than 0.', 'errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        if ($nameUnchanged) {
            $validated['name'] = $addon->getRawOriginal('name');
        }
        if ($priceUnchanged) {
            $validated['price'] = $addon->getRawOriginal('price');
        }
        $addon->update($validated);
        return response()->json($addon);
    }

    public function destroyGroup(Request $request, AddonGroup $addonGroup)
    {
        if (!$this->checkAdminAuth($request)) return response()->json(['message' => 'Unauthorized'], 401);

        $addonGroup->addons()->delete();
        $addonGroup->products()->detach();
        $addonGroup->delete();

        return response()->json(['message' => 'Add-on group deleted successfully.']);
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
        if (ProductOptionRules::isFixedPriceBeverage($product) && $groupIds !== []) {
            return response()->json(['message' => 'Add-on groups cannot be assigned to fixed-price beverage products.'], 422);
        }
        $product->addonGroups()->sync($groupIds);
        return response()->json(['message' => 'Add-on groups assigned successfully.']);
    }
}