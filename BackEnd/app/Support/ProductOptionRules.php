<?php

namespace App\Support;

use App\Models\Product;

final class ProductOptionRules
{
    private const FIXED_PRICE_BEVERAGE_CATEGORIES = ['fruity-soda-milk', 'fresh-lemonade'];

    public static function isFixedPriceBeverage(Product $product): bool
    {
        return self::isFixedPriceBeverageCategory((string) $product->category);
    }

    public static function isFixedPriceBeverageCategory(string $category): bool
    {
        return in_array(strtolower($category), self::FIXED_PRICE_BEVERAGE_CATEGORIES, true);
    }

    public static function validateSelections(Product $product, array $item): void
    {
        if (! self::isFixedPriceBeverage($product)) {
            return;
        }

        $selectedSize = $item['selected_size'] ?? null;
        $selectedAddons = $item['selected_addons'] ?? $item['selectedAddons'] ?? [];
        if ($selectedSize !== null && $selectedSize !== '') {
            throw new \InvalidArgumentException('Size options are not available for this item.');
        }
        if ($selectedAddons !== null && $selectedAddons !== '' && $selectedAddons !== []) {
            throw new \InvalidArgumentException('Add-ons are not available for this item.');
        }
    }
}
