<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Product\ProductAdminActions;
use App\Http\Controllers\Product\ProductCatalogActions;
use App\Http\Controllers\Product\ProductFranchiseActions;
use App\Models\FranchiseUser;
use App\Models\Product;
use App\Services\FranchiseService;
use App\Services\ProductImageUploadService;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use AdminAuthTrait;
    use ProductAdminActions;
    use ProductCatalogActions;
    use ProductFranchiseActions;

    public function __construct(
        private readonly ProductImageUploadService $imageUploadService,
        private readonly FranchiseService $franchiseService,
    ) {}

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

    private function franchiseUser(Request $request): ?FranchiseUser
    {
        $user = $request->user();

        return $user instanceof FranchiseUser ? $user : null;
    }

    private function franchiseProductQuery(Request $request)
    {
        $query = Product::query()->orderBy('category', 'asc')->orderBy('name', 'asc');
        $franchiseUser = $this->franchiseUser($request);

        if (! $franchiseUser) {
            return $query;
        }

        return $this->franchiseService->scopeProductQuery($query, $franchiseUser->franchise_id, true);
    }
}
